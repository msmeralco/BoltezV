import {
  listenToUserInventory,
  addApplianceToInventory,
  removeApplianceFromInventory,
  updateApplianceInInventory,
  getApplianceImageURL,
} from "../firebaseServices/database/inventoryFunctions";
import { updateConsumptionSharingPrivacy } from "../firebaseServices/database/usersFunctions";
import useAuth from "../firebaseServices/auth/useAuth";
import IoTMonitor from "../components/inventory/IoTMonitor";
import EditApplianceForm from "../components/inventory/EditApplianceForm";
import DetectionModal from "../components/inventory/DetectionModal"; // <-- Import the modal
import { useEffect, useState, useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
import { Settings, Plus, Camera } from "lucide-react";
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
  const [editingApplianceId, setEditingApplianceId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [privacySetting, setPrivacySetting] = useState("");
  const [monitoringApplianceId, setMonitoringApplianceId] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isDetectDialogOpen, setIsDetectDialogOpen] = useState(false);

  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  useEffect(() => {
    if (firestoreUser?.consumptionSharingPrivacy) {
      setPrivacySetting(firestoreUser.consumptionSharingPrivacy);
    }
  }, [firestoreUser]);

  useEffect(() => {
    if (!user?.uid) {
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
    return () => unsubscribe();
  }, [user?.uid]);

  // Pie chart logic with grouping to prevent crashes
  const pieData = useMemo(() => {
    if (!appliances || appliances.length === 0) {
      return [{ id: "No Data", label: "No Data", value: 1, color: "#cccccc" }];
    }

    // 1. Aggregate by Name to prevent duplicate IDs
    const aggregated = appliances.reduce((acc, app) => {
      const name = app.name || "Unknown";
      const val = parseFloat(app.monthlyCost?.toFixed(2) || 0);
      acc[name] = (acc[name] || 0) + val;
      return acc;
    }, {});

    // 2. Convert to array
    let dataArr = Object.entries(aggregated).map(([key, val]) => ({
      id: key,
      label: key,
      value: val,
    }));

    // 3. Handle Case: All values are 0
    const totalValue = dataArr.reduce((sum, item) => sum + item.value, 0);
    if (totalValue === 0) {
      return [
        { id: "No Usage", label: "No Usage", value: 1, color: "#cccccc" },
      ];
    }

    // 4. Sort descending
    dataArr.sort((a, b) => b.value - a.value);

    // 5. Group into "Others" if > 5 items
    if (dataArr.length > 5) {
      const top5 = dataArr.slice(0, 5);
      const others = dataArr.slice(5);
      const othersValue = others.reduce((sum, item) => sum + item.value, 0);

      if (othersValue > 0) {
        top5.push({
          id: "Others",
          label: "Others",
          value: parseFloat(othersValue.toFixed(2)),
        });
      }
      return top5;
    }

    return dataArr;
  }, [appliances]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData((prevData) => ({
        ...prevData,
        specificDaysUsed: { ...prevData.specificDaysUsed, [name]: checked },
      }));
    } else if (type === "file") {
      setFormData((prevData) => ({
        ...prevData,
        imageFile: files[0],
        addedBy: "manual",
      }));
    } else {
      setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setEditFormData((prevData) => ({
        ...prevData,
        specificDaysUsed: { ...prevData.specificDaysUsed, [name]: checked },
      }));
    } else {
      setEditFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  };

  const handleDaySelection = (preset) => {
    let newDays = { ...formData.specificDaysUsed };
    const allDays = {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: true,
    };
    const noDays = {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    };
    const weekdays = {
      ...noDays,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
    };
    const weekends = { ...noDays, saturday: true, sunday: true };

    if (preset === "all") newDays = allDays;
    else if (preset === "none") newDays = noDays;
    else if (preset === "weekdays") newDays = weekdays;
    else if (preset === "weekends") newDays = weekends;

    setFormData((prev) => ({ ...prev, specificDaysUsed: newDays }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const daysPerWeek = Object.values(formData.specificDaysUsed).filter(
        Boolean
      ).length;
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
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding appliance:", error);
      alert("Failed to add appliance. Please try again.");
    }
  };

  const handleRemoveAppliance = async (applianceId) => {
    if (!window.confirm("Are you sure you want to remove this appliance?"))
      return;
    try {
      const result = await removeApplianceFromInventory(user.uid, applianceId);
      if (result.success) {
        setAppliances((prev) =>
          prev.filter((appliance) => appliance.id !== applianceId)
        );
      }
    } catch (error) {
      console.error("Error removing appliance:", error);
      alert("Failed to remove appliance. Please try again.");
    }
  };

  const handleEditAppliance = (appliance) => {
    setEditingApplianceId(appliance.id);
    setMonitoringApplianceId(null);
    setEditFormData({
      name: appliance.name,
      type: appliance.type,
      wattage: appliance.wattage,
      hoursPerDay: appliance.hoursPerDay,
      specificDaysUsed: appliance.specificDaysUsed || {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      },
      weeksPerMonth: appliance.weeksPerMonth,
    });
  };

  const handleCancelEdit = () => {
    setEditingApplianceId(null);
    setEditFormData(null);
  };

  const handleUpdateAppliance = async (e) => {
    e.preventDefault();
    try {
      const daysPerWeek = Object.values(
        editFormData.specificDaysUsed
      ).filter(Boolean).length;
      const updateData = {
        ...editFormData,
        wattage: parseFloat(editFormData.wattage),
        hoursPerDay: parseFloat(editFormData.hoursPerDay),
        weeksPerMonth: parseInt(editFormData.weeksPerMonth, 10),
        daysPerWeek,
      };
      await updateApplianceInInventory(user.uid, editingApplianceId, updateData);
      setEditingApplianceId(null);
      setEditFormData(null);
    } catch (error) {
      console.error("Error updating appliance:", error);
      alert("Failed to update appliance. Please try again.");
    }
  };

  const handlePrivacyUpdate = async (e) => {
    e.preventDefault();
    if (!privacySetting) {
      alert("Please select a privacy setting.");
      return;
    }
    try {
      await updateConsumptionSharingPrivacy(user.uid, privacySetting);
      setIsSettingsDialogOpen(false);
    } catch (error) {
      console.error("Error updating privacy setting:", error);
      alert("Failed to update privacy setting. Please try again.");
    }
  };

  const handleToggleMonitor = (applianceId) => {
    setMonitoringApplianceId((prevId) => {
      const newId = prevId === applianceId ? null : applianceId;
      if (newId) setEditingApplianceId(null);
      return newId;
    });
  };

  // Handles detection data from the child modal
  const handleDetectionComplete = async (detectionData) => {
    const { details, originalFile } = detectionData;

    if (details) {
      const allDays = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: true,
      };

      try {
        if (!user?.uid) {
          throw new Error("User not authenticated.");
        }

        let imageUrl = "";
        if (originalFile) {
          imageUrl = await getApplianceImageURL(originalFile);
        }

        const applianceData = {
          name: details.appliance_name || "Detected Appliance",
          type: details.appliance_name || "Detected Type",
          wattage: parseFloat(details.wattage) || 0,
          hoursPerDay: 8,
          specificDaysUsed: allDays,
          weeksPerMonth: 4,
          daysPerWeek: 7,
          imageUrl: imageUrl,
          addedBy: "detection",
        };

        await addApplianceToInventory(user.uid, applianceData);

        // Reset manual form state as a precaution
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
        console.error("Error adding detected appliance:", error);
        alert("Failed to add detected appliance. Please try again.");
      }
    }
    // Modals stay open to allow further detections
  };

  const formatPrivacySetting = (setting) => {
    if (setting === "private") return "Private";
    if (setting === "connectionsOnly") return "Connections Only";
    if (setting === "public") return "Public";
    return "Loading...";
  };

  if (loading) return <div>Loading inventory...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  return (
    <div className={styles.inventoryPageContainer}>
      <section className={styles.inventorySection}>
        <h2>Consumption Summary</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "1.5rem",
            width: "100%",
            alignItems: "center",
          }}
        >
          <div
            style={{
              height: "350px",
              minWidth: "300px",
              flex: "1 1 60%",
              boxSizing: "border-box",
            }}
          >
            <ResponsivePie
              data={pieData}
              colors={{ scheme: "spectral" }}
              margin={{ top: 20, right: 140, bottom: 20, left: 20 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              borderWidth={1}
              borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="#333333"
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: "color" }}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
              legends={[
                {
                  anchor: "right",
                  direction: "column",
                  justify: false,
                  translateX: 120,
                  translateY: 0,
                  itemsSpacing: 2,
                  itemWidth: 100,
                  itemHeight: 20,
                  itemTextColor: "#999",
                  itemDirection: "left-to-right",
                  itemOpacity: 1,
                  symbolSize: 18,
                  symbolShape: "circle",
                  effects: [
                    {
                      on: "hover",
                      style: { itemTextColor: "#000" },
                    },
                  ],
                },
              ]}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              flex: "1 1 30%",
              minWidth: "200px",
              boxSizing: "border-box",
            }}
          >
            <div className={styles.summaryItem}>
              <p>Total Appliances</p>
              <span>
                {firestoreUser?.consumptionSummary?.applianceCount ?? 0}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <p>Est. Daily Bill</p>
              <span>
                PHP{" "}
                {firestoreUser?.consumptionSummary?.estimatedDailyBill?.toFixed(
                  2
                ) ?? "0.00"}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <p>Est. Monthly Bill</p>
              <span>
                PHP{" "}
                {firestoreUser?.consumptionSummary?.estimatedMonthlyBill?.toFixed(
                  2
                ) ?? "0.00"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.inventorySection}>
        <div className={styles.inventoryHeader}>
          <h2>Your Inventory</h2>
          <div className={styles.inventoryHeaderButtons}>
            <button
              className={styles.inventoryHeaderButton}
              onClick={() => setIsSettingsDialogOpen(true)}
              title="Sharing Settings"
            >
              <Settings size={18} />
            </button>
            <button
              className={styles.inventoryHeaderButton}
              onClick={() => setIsAddDialogOpen(true)}
              title="Add Appliance"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

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
                    <strong>Consumption:</strong>{" "}
                    {appliance.kWhPerDay?.toFixed(2)} kWh/day
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Daily Cost:</strong> PHP{" "}
                    {appliance.dailyCost?.toFixed(2)}
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Weekly Cost:</strong> PHP{" "}
                    {appliance.weeklyCost?.toFixed(2)}
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Monthly Cost:</strong> PHP{" "}
                    {appliance.monthlyCost?.toFixed(2)}
                  </div>
                </div>
                {editingApplianceId === appliance.id && (
                  <EditApplianceForm
                    applianceId={appliance.id}
                    editFormData={editFormData}
                    handleEditChange={handleEditChange}
                    handleUpdateAppliance={handleUpdateAppliance}
                    daysOfWeek={daysOfWeek}
                    styles={styles}
                    className={styles.span2}
                  />
                )}
                {monitoringApplianceId === appliance.id && (
                  <IoTMonitor
                    appliance={appliance}
                    applianceId={appliance.id}
                    allAppliances={appliances}
                  />
                )}
                <div className={styles.itemControls}>
                  <button
                    className={styles.formButton}
                    onClick={() => handleToggleMonitor(appliance.id)}
                    disabled={editingApplianceId === appliance.id}
                  >
                    {monitoringApplianceId === appliance.id
                      ? "Hide Monitor"
                      : "Monitor Device"}
                  </button>
                  <div className={styles.editRemoveGroup}>
                    {editingApplianceId === appliance.id ? (
                      <>
                        <button
                          type="button"
                          className={`${styles.formButton} ${styles.buttonDanger}`}
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={styles.formButton}
                          form={`edit-form-${appliance.id}`}
                        >
                          Save Changes
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className={styles.formButton}
                          onClick={() => handleEditAppliance(appliance)}
                          disabled={monitoringApplianceId === appliance.id}
                        >
                          Edit
                        </button>
                        <button
                          className={`${styles.formButton} ${styles.buttonDanger}`}
                          onClick={() => handleRemoveAppliance(appliance.id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>
            You have no appliances in your inventory. Add one to start tracking!
          </p>
        )}
      </section>

      {isSettingsDialogOpen && (
        <div
          className={styles.dialogBackdrop}
          onClick={() => setIsSettingsDialogOpen(false)}
        >
          <div
            className={styles.dialogContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.dialogClose}
              onClick={() => setIsSettingsDialogOpen(false)}
            >
              &times;
            </button>
            <h2 className={styles.dialogTitle}>Sharing Settings</h2>
            <form
              className={styles.sharingForm}
              onSubmit={handlePrivacyUpdate}
            >
              <div className={styles.sharingFormLeft}>
                <p className={styles.sharingCurrentSetting}>
                  Current Setting:{" "}
                  <strong>
                    {formatPrivacySetting(
                      firestoreUser?.consumptionSharingPrivacy
                    )}
                  </strong>
                </p>
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
              </div>
              <button type="submit" className={styles.formButton}>
                Update Privacy
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddDialogOpen && (
        <div
          className={styles.dialogBackdrop}
          onClick={() => setIsAddDialogOpen(false)}
        >
          <div
            className={styles.dialogContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.dialogClose}
              onClick={() => setIsAddDialogOpen(false)}
            >
              &times;
            </button>
            <h2 className={styles.dialogTitle}>Add an Appliance</h2>
            <form onSubmit={handleSubmit} className={styles.addForm}>
              <button
                type="button"
                className={`${styles.formButton} ${styles.span2}`}
                onClick={() => setIsDetectDialogOpen(true)}
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <Camera size={18} /> Detect From Image
              </button>

              <div
                style={{
                  width: "100%",
                  textAlign: "center",
                  margin: "-0.5rem 0 1rem 0",
                  gridColumn: "span 2",
                  color: "#888",
                }}
              >
                or add manually
              </div>

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
                  step="0.1"
                  name="hoursPerDay"
                  value={formData.hoursPerDay}
                  onChange={handleChange}
                  required
                />
              </div>
              <fieldset className={styles.span2}>
                <legend>Specific Days Used</legend>
                <div className={styles.daySelectorButtons}>
                  <button
                    type="button"
                    onClick={() => handleDaySelection("all")}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDaySelection("none")}
                  >
                    Clear All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDaySelection("weekdays")}
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDaySelection("weekends")}
                  >
                    Weekends
                  </button>
                </div>
                <div className={styles.daySelectorCheckboxes}>
                  {daysOfWeek.map((day) => (
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
                  min="1"
                  max="4"
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
                {formData.imageFile && formData.addedBy === "detection" && (
                  <div className={styles.previewDetectedImage}>
                    <p>Detected Image:</p>
                    <img
                      src={URL.createObjectURL(formData.imageFile)}
                      alt="Detected appliance"
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                className={`${styles.formButton} ${styles.span2}`}
              >
                Add Appliance
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Render the Detection Modal when state is true */}
      {isDetectDialogOpen && (
        <DetectionModal
          onClose={() => setIsDetectDialogOpen(false)}
          onDetect={handleDetectionComplete}
        />
      )}
    </div>
  );
}

export default Inventory;