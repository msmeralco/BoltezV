import { db } from "../firebaseConfig";
import { where, collection, orderBy, addDoc, doc, updateDoc, getDoc, GeoPoint, deleteField, onSnapshot, query, documentId, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";

/**
 * Add an outage document to the `outages` collection.
 *
 * - Validates minimal required fields.
 * - Converts { lat, lng } or { latitude, longitude } to a Firestore GeoPoint.
 * - Adds server timestamp as `timeCreated`.
 * - Sets sensible defaults for `approvalStatus` and `responseStatus`.
 *
 * @param {Object} outageData - Outage payload.
 * @param {string} outageData.reporterId - UID of the user creating the outage report (required).
 * @param {string} [outageData.reporterName] - Display name of the reporter.
 * @param {string} outageData.title - Short title for the outage (required).
 * @param {string} [outageData.description] - Detailed description of the outage.
 * @param {boolean} [outageData.isPlanned] - True if planned, False if unplanned.
 * @param {Object|GeoPoint} [outageData.location] - Location as a GeoPoint or an object with {lat,lng} or {latitude,longitude}.
 * @param {Array<GeoPoint>} [outageData.geopoints] - Array of GeoPoints describing the affected area.
 * @param {string} [outageData.approvalStatus] - Optional initial approval status (defaults to "pending").
 * @param {string} [outageData.responseStatus] - Optional initial response status (defaults to "in progress").
 *
 * @returns {Promise<{id: string}>} Resolves with an object containing the created document id.
 * @throws {Error} If required fields are missing or Firestore operation fails.
 */
export async function addOutage(outageData) {
    try {
        if (!outageData || typeof outageData !== "object") {
            throw new Error("outageData object is required");
        }

        const { reporterId, reporterName, title, description, isPlanned, location, geopoints, approvalStatus, responseStatus } = outageData;

        if (!reporterId) throw new Error("reporterId is required");
        if (!title) throw new Error("title is required");

        // Normalize location into a Firestore GeoPoint if coordinates provided
        let locationValue = null;
        if (location) {
            if (location instanceof GeoPoint) {
                locationValue = location;
            } else if (typeof location.lat === "number" && typeof location.lng === "number") {
                locationValue = new GeoPoint(location.lat, location.lng);
            } else if (typeof location.latitude === "number" && typeof location.longitude === "number") {
                locationValue = new GeoPoint(location.latitude, location.longitude);
            } else {
                console.warn("addOutage: unrecognized location shape, storing null for location");
            }
        }

        const outageDoc = {
            reporterId,
            reporterName: reporterName || null,
            title,
            description: description || "",
            isPlanned: isPlanned || false,
            location: locationValue,
            geopoints: Array.isArray(geopoints) ? geopoints : [],
            timeCreated: serverTimestamp(),
            approvalStatus: approvalStatus || "pending",
            responseStatus: responseStatus || "in progress",
        };

        const colRef = collection(db, "outages");
        const docRef = await addDoc(colRef, outageDoc);

        return { id: docRef.id };
    } catch (error) {
        console.error("addOutage error:", error);
        throw error;
    }
}

/**
 * Returns all outage objects from the "outages" collection in Firestore
 *
 * @param {function(Array)} onData - Callback function to pass the outages array to.
 * @param {function(Error)} onError - Callback function to handle errors.
 * @returns {function} An "unsubscribe" function to detach the listener.
 */
export async function getAllOutages(onData, onError) {
    if (typeof onData !== "function") {
        throw new Error("onData callback is required and must be a function");
    }

    const outagesRef = collection(db, "outages");
    // order by timeCreated descending so newest first; fall back to documentId if timeCreated absent
    const q = query(outagesRef, orderBy("timeCreated", "desc"));

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const outages = [];
            snapshot.forEach((doc) => {
                outages.push({ id: doc.id, ...doc.data() });
            });
            try {
                onData(outages);
            } catch (cbErr) {
                console.error("getAllOutages onData callback error:", cbErr);
            }
        },
        (err) => {
            console.error("Error listening to outages: ", err);
            if (typeof onError === "function") onError(err);
        }
    );

    return unsubscribe;
}

/**
 * Deletes an outage document from the `outages` collection.
 *
 * @param {string} outageId - The ID of the outage document to delete.
 * @returns {Promise<void>} Resolves when the document is successfully deleted.
 * @throws {Error} If the Firestore operation fails or the outageId is invalid.
 */
export async function deleteOutage(outageId) {
  if (!outageId || typeof outageId !== "string") {
    throw new Error("Valid outageId is required");
  }

  try {
    const docRef = doc(db, "outages", outageId);
    await deleteDoc(docRef);
    console.log(`Outage with ID ${outageId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting outage:", error);
    throw error;
  }
}

/**
 * Updates the `responseStatus` field of an outage document in the `outages` collection.
 *
 * @param {string} outageId - The ID of the outage document to update.
 * @param {string} newStatus - The new response status to set. Possible values: "not started", "in progress", "fixed".
 * @returns {Promise<void>} Resolves when the document is successfully updated.
 * @throws {Error} If the Firestore operation fails or the input parameters are invalid.
 */
export async function updateOutageResponseStatus(outageId, newStatus) {
  if (!outageId || typeof outageId !== "string") {
    throw new Error("Valid outageId is required");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new Error("Valid newStatus is required");
  }

  try {
    const docRef = doc(db, "outages", outageId);
    await updateDoc(docRef, { responseStatus: newStatus });
    console.log(`Outage with ID ${outageId} updated to responseStatus: ${newStatus}`);
  } catch (error) {
    console.error("Error updating outage responseStatus:", error);
    throw error;
  }
}

/**
 * Updates the `approvalStatus` field of an outage document in the `outages` collection.
 *
 * @param {string} outageId - The ID of the outage document to update.
 * @param {string} newStatus - The new approval status to set. Possible values: "pending", "approved", "rejected".
 * @returns {Promise<void>} Resolves when the document is successfully updated.
 * @throws {Error} If the Firestore operation fails or the input parameters are invalid.
 */
export async function updateOutageApprovalStatus(outageId, newStatus) {
  if (!outageId || typeof outageId !== "string") {
    throw new Error("Valid outageId is required");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new Error("Valid newStatus is required");
  }

  try {
    const docRef = doc(db, "outages", outageId);
    await updateDoc(docRef, { approvalStatus: newStatus });
    console.log(`Outage with ID ${outageId} updated to approvalStatus: ${newStatus}`);
  } catch (error) {
    console.error("Error updating outage approvalStatus:", error);
    throw error;
  }
}

/**
 * Retrieves an outage document by its ID from the `outages` collection.
 *
 * @param {string} outageId - The ID of the outage document to retrieve.
 * @returns {Promise<Object>} Resolves with the outage object if found.
 * @throws {Error} If the Firestore operation fails or the outageId is invalid.
 */
export async function getOutageById(outageId) {
  if (!outageId || typeof outageId !== "string") {
    throw new Error("Valid outageId is required");
  }

  try {
    const docRef = doc(db, "outages", outageId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Outage with ID ${outageId} does not exist.`);
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error("Error retrieving outage:", error);
    throw error;
  }
}