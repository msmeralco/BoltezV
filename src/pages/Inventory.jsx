import { listenToUserInventory, addApplianceToInventory, removeApplianceFromInventory, getApplianceImageURL } from "../firebaseServices/database/inventoryFunctions";
import { updateConsumptionSharingPrivacy } from "../firebaseServices/database/usersFunctions";
import useAuth from "../firebaseServices/auth/useAuth";
import { useEffect, useState } from "react";
import styles from "./Inventory.module.css";

function Inventory() {
  const { user, firestoreUser } = useAuth();
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    wattage: "",
    hoursPerDay: "",
    specificDaysUsed: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    },
    weeksPerMonth: "",
    addedBy: "manual",
    imageFile: null,
  });
  const [privacySetting, setPrivacySetting] = useState(firestoreUser?.consumptionSharingPrivacy || "");

  useEffect(() => {
    if (firestoreUser?.consumptionSharingPrivacy) {
      setPrivacySetting(firestoreUser.consumptionSharingPrivacy);
    }
  }, [firestoreUser]);

  useEffect(() => {
    if (!user.uid) {
      setAppliances([]);
      return;
    }

    function handleData(applianceData) {
      setAppliances(applianceData);
      setLoading(false);
    }
    function handleError(err) {
      setError(err.message);
      setLoading(false);
    }

    const unsubscribe = listenToUserInventory(user.uid, handleData, handleError);

    return () => {
      unsubscribe();
    };
  }, [user.uid]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData((prevData) => ({
        ...prevData,
        specificDaysUsed: {
          ...prevData.specificDaysUsed,
          [name]: checked,
        },
      }));
    } else if (type === "file") {
      setFormData((prevData) => ({
        ...prevData,
        imageFile: files[0],
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const setSpecificDays = (daysToSet) => {
    setFormData((prevData) => ({
      ...prevData,
      specificDaysUsed: daysToSet,
    }));
  };

  const handleDaySelection = (type) => {
    const allDays = { ...formData.specificDaysUsed };
    const allDaysFalse = {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    };

    switch (type) {
      case "all":
        setSpecificDays(Object.keys(allDays).reduce((acc, day) => ({ ...acc, [day]: true }), {}));
        break;
      case "none":
        setSpecificDays(allDaysFalse);
        break;
      case "weekdays":
        setSpecificDays({
          ...allDaysFalse,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
        });
        break;
      case "weekends":
        setSpecificDays({
          ...allDaysFalse,
          saturday: true,
          sunday: true,
        });
        break;
      default:
        break;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const daysPerWeek = Object.values(formData.specificDaysUsed).filter(Boolean).length;

      let imageUrl = "";
      if (formData.imageFile) {
        imageUrl = await getApplianceImageURL(formData.imageFile);
      }

      const { imageFile, ...applianceData } = {
        ...formData,
        wattage: parseFloat(formData.wattage),
        hoursPerDay: parseFloat(formData.hoursPerDay),
        weeksPerMonth: parseInt(formData.weeksPerMonth, 10),
        daysPerWeek,
        imageUrl,
      };

      await addApplianceToInventory(user.uid, applianceData);
      setFormData({
        name: "",
        type: "",
        wattage: "",
        hoursPerDay: "",
        specificDaysUsed: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        },
        weeksPerMonth: "",
        addedBy: "manual",
        imageFile: null,
      });
    } catch (error) {
      console.error("Error adding appliance:", error);
      alert("Failed to add appliance. Please try again.");
    }
  };

  const handleRemoveAppliance = async (applianceId) => {
    if (!window.confirm("Are you sure you want to remove this appliance?")) {
      return;
    }
    try {
      const result = await removeApplianceFromInventory(user.uid, applianceId);
      if (result.success) {
        setAppliances((prev) => prev.filter((appliance) => appliance.id !== applianceId));
      }
    } catch (error) {
      console.error("Error removing appliance:", error);
      alert("Failed to remove appliance. Please try again.");
    }
  };

  const handlePrivacyUpdate = async (e) => {
    e.preventDefault();

    try {
      await updateConsumptionSharingPrivacy(user.uid, privacySetting);
      alert("Privacy setting updated!");
    } catch (error) {
      console.error("Error updating privacy setting:", error);
      alert("Failed to update privacy setting. Please try again.");
    }
  };

  if (loading) {
    return <div>Loading inventory...</div>;
  }
  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  return (
    <div className={styles.inventoryPageContainer}>
      <section className={styles.inventorySection}>
        <h2>Your Inventory</h2>
        {appliances.length > 0 ? (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            {appliances.map((appliance) => (
              <div className={styles.applianceItem} key={appliance.id}>
                <div className={styles.itemHeader}>
                  <h1>{appliance.name}</h1>
                  <h6 className={styles.subtitle}>{appliance.type}</h6>
                </div>

                {appliance.imageUrl && (
                  <div className={styles.itemImageWrapper}>
                    <img src={appliance.imageUrl} alt={appliance.name} />
                  </div>
                )}

                <div className={styles.statsGrid}>
                  <div className={styles.statsItem}>
                    <strong>Wattage:</strong> {appliance.wattage}W
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Usage:</strong> {appliance.hoursPerDay} hours/day
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Consumption:</strong> {appliance.kWhPerDay?.toFixed(2)} kWh/day
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Daily Cost:</strong> PHP {appliance.dailyCost?.toFixed(2)}
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Weekly Cost:</strong> PHP {appliance.weeklyCost?.toFixed(2)}
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Monthly Cost:</strong> PHP {appliance.monthlyCost?.toFixed(2)}
                  </div>
                </div>

                <div className={styles.itemControls}>
                  <button className={styles.formButton}>Monitor Device</button>
                  <button
                    className={`${styles.formButton} ${styles.buttonDanger}`}
                    onClick={() => handleRemoveAppliance(appliance.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>You have no appliances in your inventory. Add one below to start tracking!</p>
        )}
      </section>

      <section className={styles.inventorySection}>
        <h2>Consumption Summary</h2>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <p>Total Appliances</p>
            <span>{firestoreUser?.consumptionSummary?.applianceCount ?? 0}</span>
          </div>
          <div className={styles.summaryItem}>
            <p>Est. Daily Bill</p>
            <span>PHP {firestoreUser?.consumptionSummary?.estimatedDailyBill?.toFixed(2) ?? "0.00"}</span>
          </div>
          <div className={styles.summaryItem}>
            <p>Est. Monthly Bill</p>
            <span>PHP {firestoreUser?.consumptionSummary?.estimatedMonthlyBill?.toFixed(2) ?? "0.00"}</span>
          </div>
          <div className={`${styles.summaryItem} ${styles.topAppliance}`}>
            <p>Top Appliance</p>
            <span>{firestoreUser?.consumptionSummary?.topAppliance ?? "N/A"}</span>
          </div>
        </div>
      </section>

      <section className={styles.inventorySection}>
        <h2>Sharing Settings</h2>
        <p>
          Current Setting: <strong>{firestoreUser?.consumptionSharingPrivacy ?? "Loading..."}</strong>
        </p>
        <form className={styles.sharingForm} onSubmit={handlePrivacyUpdate}>
          <div className={styles.formGroup}>
            <label htmlFor="privacy-select">Update Privacy</label>
            <select
              id="privacy-select"
              className={styles.formSelect}
              name="privacySetting"
              value={privacySetting}
              onChange={(e) => setPrivacySetting(e.target.value)}
              required
            >
              <option value="">Select a setting</option>
              <option value="private">Private</option>
              <option value="connectionsOnly">Connections Only</option>
              <option value="public">Public</option>
            </select>
          </div>
          <button type="submit" className={styles.formButton}>
            Update Privacy
          </button>
        </form>
      </section>

      <section className={styles.inventorySection}>
        <h2>Add an Appliance</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Appliance Name</label>
            <input
              id="name"
              className={styles.formInput}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="type">Appliance Type (e.g., Fan, TV)</label>
            <input
              id="type"
              className={styles.formInput}
              type="text"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="wattage">Wattage (W)</label>
            <input
              id="wattage"
              className={styles.formInput}
              type="number"
              name="wattage"
              value={formData.wattage}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="hoursPerDay">Hours Used Per Day</label>
            <input
              id="hoursPerDay"
              className={styles.formInput}
              type="number"
              name="hoursPerDay"
              value={formData.hoursPerDay}
              onChange={handleChange}
              required
            />
          </div>

          <fieldset className={styles.span2}>
            <legend>Specific Days Used</legend>
            <div className={styles.daySelectorButtons}>
              <button type="button" onClick={() => handleDaySelection("all")}>
                Select All
              </button>
              <button type="button" onClick={() => handleDaySelection("none")}>
                Clear All
              </button>
              <button type="button" onClick={() => handleDaySelection("weekdays")}>
                Weekdays
              </button>
              <button type="button" onClick={() => handleDaySelection("weekends")}>
                Weekends
              </button>
            </div>
            <div className={styles.daySelectorCheckboxes}>
              {Object.keys(formData.specificDaysUsed).map((day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    name={day}
                    checked={formData.specificDaysUsed[day]}
                    onChange={handleChange}
                  />
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.formGroup}>
            <label htmlFor="weeksPerMonth">Weeks Used Per Month</label>
            <input
              id="weeksPerMonth"
              className={styles.formInput}
              type="number"
              name="weeksPerMonth"
              value={formData.weeksPerMonth}
              onChange={handleChange}
              required
            />
          </div>

          <div className={`${styles.formGroup} ${styles.span2}`}>
            <label htmlFor="imageFile">Upload Image (Optional)</label>
            <input
              id="imageFile"
              className={styles.formInput}
              type="file"
              name="imageFile"
              accept="image/jpeg, image/png"
              onChange={handleChange}
            />
          </div>

          <button type="submit" className={`${styles.formButton} ${styles.span2}`}>
            Add Appliance
          </button>
        </form>
      </section>
    </div>
  );
}

export default Inventory;