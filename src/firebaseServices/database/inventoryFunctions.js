import { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import { db } from "../firebaseConfig";
import { where, collection, orderBy, addDoc, doc, updateDoc, getDoc, setDoc, GeoPoint, deleteField, onSnapshot, query, documentId, deleteDoc, getDocs } from "firebase/firestore";

// Environment Variables
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const APPLIANCE_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_APPLIANCE_UPLOAD_PRESET;


/**
 * Attaches a real-time listener to a user's appliance inventory subcollection.
 *
 * @param {string} userId - The UID of the user whose inventory to listen to.
 * @param {function(Array)} onData - Callback function to pass the appliance array to.
 * @param {function(Error)} onError - Callback function to handle errors.
 * @returns {function} An "unsubscribe" function to detach the listener.
 */
export function listenToUserInventory(userId, onData, onError) {
  // 1. Create a reference to the user's "inventory" subcollection
  const inventoryRef = collection(db, "users", userId, "inventory");

  // 2. Create a query. We'll order by name just to keep the list stable.
  const q = query(inventoryRef, orderBy("name"));

  // 3. Attach the onSnapshot listener to the entire query
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const appliances = [];
      snapshot.forEach((doc) => {
        appliances.push({ id: doc.id, ...doc.data() });
      });
      // 4. Pass the complete, updated list to the React component
      onData(appliances);
      updateUserConsumptionSummary(userId);
    },
    (error) => {
      // Handle any errors (like permission denied)
      console.error("Error listening to inventory: ", error);
      onError(error);
    }
  );

  // 5. Return the unsubscribe function so the component can clean up
  return unsubscribe;
}

/**
 * Adds an appliance to a user's inventory subcollection in Firestore.
 *
 * @param {string} userId - The UID of the user whose inventory the appliance will be added to.
 * @param {object} applianceData - The data of the appliance to add.
 * @returns {Promise<object>} - A promise that resolves to an object containing the added appliance's ID and data.
 * @throws {Error} - Throws an error if the operation fails.
 */
export async function addApplianceToInventory(userId, applianceData) {
  if (!userId) {
    throw new Error("User ID is required to add an appliance to inventory.");
  }

  if (!applianceData || typeof applianceData !== "object") {
    throw new Error("Appliance data must be a valid object.");
  }

  const inventoryRef = collection(db, "users", userId, "inventory");

  try {
    // ✅ ADD AWAIT
    const costData = await calculateApplianceCost(applianceData);

    const applianceDataWithCosts = {
      ...applianceData,
      ...costData,
    };

    const docRef = await addDoc(inventoryRef, applianceDataWithCosts);
    updateUserConsumptionSummary(userId);
    return { id: docRef.id, ...applianceDataWithCosts };
  } catch (err) {
    console.error("Error adding appliance to inventory:", err);
    throw new Error("Failed to add appliance to inventory.");
  }
}

/**
 * Updates an existing appliance in a user's inventory in Firestore.
 *
 * @param {string} userId - The UID of the user whose inventory the appliance belongs to.
 * @param {string} applianceId - The ID of the appliance to update.
 * @param {object} updatedData - The updated data for the appliance.
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the update.
 *   - `applianceId` (string): The ID of the updated appliance.
 * @throws {Error} - Throws an error if the operation fails.
 */
export async function updateApplianceInInventory(userId, applianceId, updatedData) {
  if (!userId || !applianceId) {
    throw new Error("Both userId and applianceId are required to update an appliance in inventory.");
  }

  if (!updatedData || typeof updatedData !== "object") {
    throw new Error("Updated data must be a valid object.");
  }

  try {
    const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
    
    let updatePayload = { ...updatedData };
    if (updatedData.specificDaysUsed) {
      const daysPerWeek = Object.values(updatedData.specificDaysUsed).filter(Boolean).length;
      updatePayload.daysPerWeek = daysPerWeek;
    }

    // ✅ ADD AWAIT
    const costData = await calculateApplianceCost(updatePayload);
    updatePayload = {
      ...updatePayload,
      ...costData,
      updatedAt: new Date(),
    };

    await updateDoc(applianceDocRef, updatePayload);
    await updateUserConsumptionSummary(userId);

    console.log(`Appliance ${applianceId} successfully updated.`);
    return {
      success: true,
      message: `Appliance ${applianceId} successfully updated.`,
      applianceId,
    };
  } catch (error) {
    console.error("Error updating appliance in inventory:", error);
    throw new Error("Failed to update appliance in inventory.");
  }
}

/**
 * Removes an appliance from a user's inventory in Firestore.
 *
 * @param {string} userId - The UID of the user whose inventory the appliance will be removed from.
 * @param {string} applianceId - The ID of the appliance to remove.
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the removal.
 *   - `applianceId` (string): The ID of the removed appliance.
 * @throws {Error} - Throws an error if the operation fails.
 */
export async function removeApplianceFromInventory(userId, applianceId) {
  if (!userId || !applianceId) {
    throw new Error("Both userId and applianceId are required to remove an appliance from inventory.");
  }

  try {
    const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
    await deleteDoc(applianceDocRef);
    updateUserConsumptionSummary(userId);
    console.log(`Appliance ${applianceId} permanently removed from inventory.`);
    return {
      success: true,
      message: `Appliance ${applianceId} successfully removed from inventory.`,
      applianceId,
    };
  } catch (error) {
    console.error("Error removing appliance from inventory:", error);
    throw new Error("Failed to remove appliance from inventory.");
  }
}

/**
 * Fetches the current Meralco rate from the API or Firebase cache.
 * Updates the cached rate if it's a new month.
 * 
 * The function checks if a cached rate exists for the current month in Firebase.
 * If not, it fetches a fresh rate from the Meralco Rate API and caches it.
 * This ensures the rate is automatically updated at the start of each month.
 * 
 * @returns {Promise<number>} - The current Meralco rate in PHP per kWh
 * @throws {Error} - Falls back to default rate (13.4702) if API fetch fails
 */

export async function getMeralcoRate() {
  const rateDocRef = doc(db, "settings", "meralcoRate");
  
  try {
    // Get cached rate from Firebase
    const rateDoc = await getDoc(rateDocRef);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if we have a cached rate for the current month
    if (rateDoc.exists()) {
      const data = rateDoc.data();
      if (data.month === currentMonth && data.rate) {
        console.log("Using cached Meralco rate:", data.rate);
        return data.rate;
      }
    }
    
    // Fetch new rate from API
    console.log("Fetching new Meralco rate from API...");
    const response = await fetch("https://meralco-rate-api.onrender.com/rate");
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Meralco rate: ${response.status}`);
    }
    
    const rateData = await response.json();
    const newRate = rateData.rate;
    
    // Cache the new rate in Firebase (use setDoc to create if doesn't exist)
    await setDoc(rateDocRef, {
      rate: newRate,
      month: currentMonth,
      lastUpdated: new Date(),
      source: rateData.source,
      published: rateData.published,
    }, { merge: true }); // merge: true will update if exists, create if doesn't
    
    console.log("Meralco rate updated:", newRate);
    return newRate;
    
  } catch (error) {
    console.error("Error fetching Meralco rate, using fallback:", error);
    return 13.4702;;
  }
}

/**
 * Calculates the energy consumption and cost of running an appliance.
 *
 * @param {object} applianceData - The data of the appliance. Must include wattage, hoursPerDay, daysPerWeek, and weeksPerMonth.
 * @returns {object} - An object containing:
 *   - `kWhPerDay` (number): The energy consumption in kilowatt-hours per day.
 *   - `dailyCost` (number): The cost of running the appliance per day.
 *   - `weeklyCost` (number): The cost of running the appliance per week.
 *   - `monthlyCost` (number): The cost of running the appliance per month.
 */

export async function calculateApplianceCost(applianceData) {
  const MERALCO_RATE = await getMeralcoRate();

  if (!applianceData || typeof applianceData !== "object") {
    throw new Error("Appliance data must be a valid object.");
  }

  const { wattage, hoursPerDay, daysPerWeek, weeksPerMonth } = applianceData;

  if (!wattage || !hoursPerDay || !daysPerWeek || !weeksPerMonth) {
    throw new Error("Appliance data must include wattage, hoursPerDay, daysPerWeek, and weeksPerMonth.");
  }

  // Calculate kWh per day
  const kWhPerDay = (wattage * hoursPerDay) / 1000;

  // Calculate costs
  const dailyCost = kWhPerDay * MERALCO_RATE;
  const weeklyCost = dailyCost * daysPerWeek;
  const monthlyCost = weeklyCost * weeksPerMonth;

  return {
    kWhPerDay,
    dailyCost,
    weeklyCost,
    monthlyCost,
  };
}

/**
 * Calculates the total daily, weekly, and monthly costs for all appliances in the provided data.
 *
 * @param {Array} appliancesData - An array of appliance objects. Each object must include:
 *   - `dailyCost` (number): The cost of running the appliance per day.
 *   - `weeklyCost` (number): The cost of running the appliance per week.
 *   - `monthlyCost` (number): The cost of running the appliance per month.
 *
 * @returns {object} - An object containing the total costs:
 *   - `totalDailyCost` (number): The total daily cost for all appliances.
 *   - `totalWeeklyCost` (number): The total weekly cost for all appliances.
 *   - `totalMonthlyCost` (number): The total monthly cost for all appliances.
 *   - `applianceCount` (number): The total number of appliances.
 *   - `topAppliance` (string|null): The name of the appliance with the highest daily cost, or null if no appliances are present.
 *
 * @throws {Error} - Throws an error if `appliancesData` is not an array.
 */
export function calculateConsumptionSummary(appliancesData) {
  if (!Array.isArray(appliancesData)) {
    throw new Error("appliancesData must be an array of appliance objects.");
  }

  let totalDailyCost = 0;
  let totalWeeklyCost = 0;
  let totalMonthlyCost = 0;
  let topAppliance = null;
  let maxDailyCost = 0;

  appliancesData.forEach((appliance) => {
    if (
      typeof appliance.dailyCost === "number" &&
      typeof appliance.weeklyCost === "number" &&
      typeof appliance.monthlyCost === "number"
    ) {
      totalDailyCost += appliance.dailyCost;
      totalWeeklyCost += appliance.weeklyCost;
      totalMonthlyCost += appliance.monthlyCost;

      if (appliance.dailyCost > maxDailyCost) {
        maxDailyCost = appliance.dailyCost;
        topAppliance = appliance.name;
      }
    }
  });

  return {
    totalDailyCost,
    totalWeeklyCost,
    totalMonthlyCost,
    applianceCount: appliancesData.length,
    topAppliance,
  };
}

/**
 * Updates the consumption summary for a user in Firestore based on their inventory.
 *
 * This function fetches all appliances in the user's inventory, calculates the total
 * energy consumption and costs, and updates the `consumptionSummary` field in the
 * user's Firestore document. The summary includes the total number of appliances,
 * estimated daily, weekly, and monthly bills, and the top appliance contributing
 * the most to the daily cost.
 *
 * @param {string} userId - The UID of the user whose consumption summary will be updated.
 * @returns {Promise<object>} - A promise that resolves to the calculated consumption summary object, which includes:
 *   - `applianceCount` (number): The total number of appliances.
 *   - `totalDailyCost` (number): The total daily cost for all appliances.
 *   - `totalWeeklyCost` (number): The total weekly cost for all appliances.
 *   - `totalMonthlyCost` (number): The total monthly cost for all appliances.
 *   - `topAppliance` (string|null): The name of the appliance with the highest daily cost, or null if no appliances are present.
 *
 * @throws {Error} - Throws an error if the user ID is not provided or if the operation fails.
 */
export async function updateUserConsumptionSummary(userId) {
  if (!userId) {
    throw new Error("User ID is required to update the consumption summary.");
  }

  const inventoryRef = collection(db, "users", userId, "inventory");
  const userDocRef = doc(db, "users", userId);

  try {
    // Fetch all appliances in the user's inventory
    const snapshot = await getDocs(inventoryRef);
    const appliancesData = snapshot.docs.map((doc) => doc.data());

    // Calculate the consumption summary
    const consumptionSummary = calculateConsumptionSummary(appliancesData);

    // Update the user's consumption summary field in Firestore
    await updateDoc(userDocRef, {
      consumptionSummary: {
        applianceCount: consumptionSummary.applianceCount,
        estimatedDailyBill: consumptionSummary.totalDailyCost,
        estimatedWeeklyBill: consumptionSummary.totalWeeklyCost,
        estimatedMonthlyBill: consumptionSummary.totalMonthlyCost,
        topAppliance: consumptionSummary.topAppliance,
      },
    });

    console.log("User consumption summary updated successfully.");
    return consumptionSummary;
  } catch (error) {
    console.error("Error updating user consumption summary:", error);
    throw new Error("Failed to update user consumption summary.");
  }

}

/**
 * Uploads an image file to Cloudinary and retrieves the secure URL of the uploaded image.
 *
 * This function uses the Cloudinary API to upload an image file. The `APPLIANCE_UPLOAD_PRESET`
 * and `CLOUD_NAME` environment variables are used to configure the upload.
 *
 * @param {File} imageFile - The image file to upload. Must be a valid file object.
 * @returns {Promise<string|null>} - A promise that resolves to the secure URL of the uploaded image,
 * or `null` if the upload fails or no file is provided.
 *
 * @throws {Error} - Throws an error if the Cloudinary upload fails.
 */
export async function getApplianceImageURL(imageFile) {
  if (!imageFile) return null;

  try {
    const form = new FormData();
    form.append("file", imageFile);
    form.append("upload_preset", APPLIANCE_UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary upload failed: ${res.status} ${errText}`);
    }

    const imageURL = await res.json();
    // return the URL string (secure_url is recommended)
    return imageURL?.secure_url || "";
  } catch (err) {
    console.error("Image upload error:", err);
    return null;
  }
}