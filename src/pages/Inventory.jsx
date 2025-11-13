import { listenToUserInventory, addApplianceToInventory, removeApplianceFromInventory, updateApplianceInInventory, getApplianceImageURL } from "../firebaseServices/database/inventoryFunctions";
import useAuth from "../firebaseServices/auth/useAuth";
import IoTMonitor from "../components/inventory/IoTMonitor";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

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

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setEditFormData((prevData) => ({
        ...prevData,
        specificDaysUsed: {
          ...prevData.specificDaysUsed,
          [name]: checked,
        },
      }));
    } else {
      setEditFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
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
      alert("Appliance added successfully!");
    } catch (error) {
      console.error("Error adding appliance:", error);
      alert("Failed to add appliance. Please try again.");
    }
  };

  const handleRemoveAppliance = async (applianceId) => {
    if (!window.confirm("Are you sure you want to remove this appliance?")) return;

    try {
      const result = await removeApplianceFromInventory(user.uid, applianceId);
      if (result.success) {
        setAppliances((prev) => prev.filter((appliance) => appliance.id !== applianceId));
        alert("Appliance removed successfully!");
      }
    } catch (error) {
      console.error("Error removing appliance:", error);
      alert("Failed to remove appliance. Please try again.");
    }
  };

  const handleEditAppliance = (appliance) => {
    setEditingApplianceId(appliance.id);
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
      const updateData = {
        ...editFormData,
        wattage: parseFloat(editFormData.wattage),
        hoursPerDay: parseFloat(editFormData.hoursPerDay),
        weeksPerMonth: parseInt(editFormData.weeksPerMonth, 10),
      };

      await updateApplianceInInventory(user.uid, editingApplianceId, updateData);
      
      setEditingApplianceId(null);
      setEditFormData(null);
      alert("Appliance updated successfully!");
    } catch (error) {
      console.error("Error updating appliance:", error);
      alert("Failed to update appliance. Please try again.");
    }
  };

  if (loading) {
    return <div>Loading inventory...</div>;
  }
  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Your Inventory</h1>

      {appliances.length > 0 ? (
        <ul>
          {appliances.map((appliance) => (
            <li key={appliance.id}>
              {editingApplianceId === appliance.id ? (
                // Edit Form
                <form onSubmit={handleUpdateAppliance}>
                  <h3>Edit Appliance</h3>
                  
                  <label>
                    Name:
                    <input 
                      type="text" 
                      name="name" 
                      value={editFormData.name} 
                      onChange={handleEditChange} 
                      required 
                    />
                  </label>
                  <br />
                  
                  <label>
                    Type:
                    <input 
                      type="text" 
                      name="type" 
                      value={editFormData.type} 
                      onChange={handleEditChange} 
                      required 
                    />
                  </label>
                  <br />
                  
                  <label>
                    Wattage:
                    <input 
                      type="number" 
                      name="wattage" 
                      value={editFormData.wattage} 
                      onChange={handleEditChange} 
                      required 
                    />
                  </label>
                  <br />
                  
                  <label>
                    Hours Per Day:
                    <input 
                      type="number" 
                      step="0.1"
                      name="hoursPerDay" 
                      value={editFormData.hoursPerDay} 
                      onChange={handleEditChange} 
                      required 
                    />
                  </label>
                  <br />
                  
                  <fieldset>
                    <legend>Specific Days Used:</legend>
                    {daysOfWeek.map((day) => (
                      <label key={day}>
                        <input
                          type="checkbox"
                          name={day}
                          checked={editFormData.specificDaysUsed[day]}
                          onChange={handleEditChange}
                        />
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </label>
                    ))}
                  </fieldset>
                  <br />
                  
                  <label>
                    Weeks Per Month:
                    <input 
                      type="number" 
                      name="weeksPerMonth" 
                      value={editFormData.weeksPerMonth} 
                      onChange={handleEditChange} 
                      required 
                      min="1"
                      max="4"
                    />
                  </label>
                  <br />
                  
                  <button type="submit">Save Changes</button>
                  <button type="button" onClick={handleCancelEdit}>Cancel</button>
                </form>
              ) : (
                // Display Mode
                <>
                  <strong>{appliance.name}</strong> ({appliance.type})
                  <br />
                  {appliance.imageUrl && (
                    <img
                      src={appliance.imageUrl}
                      alt={appliance.name}
                      style={{ height: "300px", width: "auto" }}
                    />
                  )}
                  <p>Wattage: {appliance.wattage}W</p>
                  <p>Usage: {appliance.hoursPerDay} hours per day</p>
                  <p>Days per week: {appliance.daysPerWeek}</p>
                  <p>Weeks per month: {appliance.weeksPerMonth}</p>
                  <p>Energy Consumption: {appliance.kWhPerDay?.toFixed(2)} kWh/day</p>
                  <p>Daily Cost: PHP {appliance.dailyCost?.toFixed(2)}</p>
                  <p>Weekly Cost: PHP {appliance.weeklyCost?.toFixed(2)}</p>
                  <p>Monthly Cost: PHP {appliance.monthlyCost?.toFixed(2)}</p>
                  
                  <IoTMonitor appliance={appliance} applianceId={appliance.id} allAppliances={appliances} />
                  
                  <button onClick={() => handleEditAppliance(appliance)}>Edit</button>
                  <button onClick={() => handleRemoveAppliance(appliance.id)}>Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no appliances in your inventory. Add an appliance to start tracking your power consumption!</p>
      )}

      <h2>Consumption Summary</h2>
      <div>
        <p>Total Appliances: {firestoreUser.consumptionSummary.applianceCount}</p>
        <p>Estimated Daily Bill: PHP {firestoreUser.consumptionSummary.estimatedDailyBill.toFixed(2)}</p>
        <p>Estimated Weekly Bill: PHP {firestoreUser.consumptionSummary.estimatedWeeklyBill.toFixed(2)}</p>
        <p>Estimated Monthly Bill: PHP {firestoreUser.consumptionSummary.estimatedMonthlyBill.toFixed(2)}</p>
        <p>Top Appliance: {firestoreUser.consumptionSummary.topAppliance}</p>
      </div>

      <h2>Add an Appliance</h2>

      <form onSubmit={handleSubmit}>
        <label>
          Name:
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </label>
        <br />
        <label>
          Type:
          <input type="text" name="type" value={formData.type} onChange={handleChange} required />
        </label>
        <br />
        <label>
          Wattage:
          <input type="number" name="wattage" value={formData.wattage} onChange={handleChange} required />
        </label>
        <br />
        <label>
          Hours Per Day:
          <input type="number" step="0.1" name="hoursPerDay" value={formData.hoursPerDay} onChange={handleChange} required />
        </label>
        <br />
        <fieldset>
          <legend>Specific Days Used:</legend>
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
        </fieldset>
        <br />
        <label>
          Weeks Per Month:
          <input type="number" name="weeksPerMonth" value={formData.weeksPerMonth} onChange={handleChange} required min="1" max="4" />
        </label>
        <br />
        <label>
          Image File:
          <input
            type="file"
            name="imageFile"
            accept="image/jpeg, image/png"
            onChange={handleChange}
          />
        </label>
        <br />
        <button type="submit">Add Appliance</button>
      </form>
    </div>
  );
}

export default Inventory;