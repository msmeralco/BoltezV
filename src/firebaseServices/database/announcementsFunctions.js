import { db } from "../firebaseConfig";
import { where, collection, orderBy, addDoc, doc, updateDoc, getDoc, GeoPoint, deleteField, onSnapshot, query, documentId, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";

/**
 * Add an announcement document to the `announcements` collection.
 *
 * - Validates minimal required fields.
 * - Converts { lat, lng } or { latitude, longitude } to a Firestore GeoPoint.
 * - Adds server timestamp as `timeCreated`.
 *
 * @param {Object} announcementData - Announcement payload.
 * @param {string} announcementData.userId - UID of the user creating the announcement (required).
 * @param {string} announcementData.title - Title of the announcement (required).
 * @param {string} [announcementData.description] - Description/body of the announcement.
 * @param {Object|GeoPoint} [announcementData.location] - Location as a GeoPoint or an object with {lat,lng} or {latitude,longitude}.
 * @param {Array<GeoPoint>} [announcementData.geopoints] - Array of GeoPoints describing the affected area.
 * @param {string} [announcementData.startTime] - Start time of the announced event.
 * @param {string} [announcementData.endTime] - End time of the announced event.
 *
 * @returns {Promise<{id: string}>} Resolves with an object containing the created document id.
 * @throws {Error} If required fields are missing or Firestore operation fails.
 */
export async function addAnnouncement(announcementData) {
    try {
        if (!announcementData || typeof announcementData !== "object") {
            throw new Error("announcementData object is required");
        }

        const { userId, title, description, location, geopoints, startTime, endTime } = announcementData;

        if (!userId) throw new Error("userId is required");
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
                console.warn("addAnnouncement: unrecognized location shape, storing null for location");
            }
        }

        const announcementDoc = {
            userId,
            title,
            description: description || "",
            location: locationValue,
            geopoints: Array.isArray(geopoints) ? geopoints : [],
            startTime: startTime || null,
            endTime: endTime || null,
            timeCreated: serverTimestamp(),
        };

        const colRef = collection(db, "announcements");
        const docRef = await addDoc(colRef, announcementDoc);

        return { id: docRef.id };
    } catch (error) {
        console.error("addAnnouncement error:", error);
        throw error;
    }
}

/**
 * Returns all announcement objects from the "announcements" collection in Firestore
 *
 * @param {function(Array)} onData - Callback function to pass the announcements array to.
 * @param {function(Error)} onError - Callback function to handle errors.
 * @returns {function} An "unsubscribe" function to detach the listener.
 */
export async function getAllAnnouncements(onData, onError) {
    if (typeof onData !== "function") {
        throw new Error("onData callback is required and must be a function");
    }

    const announcementsRef = collection(db, "announcements");
    // order by timeCreated descending so newest first; fall back to documentId if timeCreated absent
    const q = query(announcementsRef, orderBy("timeCreated", "desc"));

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const announcements = [];
            snapshot.forEach((doc) => {
                announcements.push({ id: doc.id, ...doc.data() });
            });
            try {
                onData(announcements);
            } catch (cbErr) {
                console.error("getAllAnnouncements onData callback error:", cbErr);
            }
        },
        (err) => {
            console.error("Error listening to announcements: ", err);
            if (typeof onError === "function") onError(err);
        }
    );

    return unsubscribe;
}

/**
 * Deletes an announcement document from the `announcements` collection.
 *
 * @param {string} announcementId - The ID of the announcement document to delete.
 * @returns {Promise<void>} Resolves when the document is successfully deleted.
 * @throws {Error} If the Firestore operation fails or the announcementId is invalid.
 */
export async function deleteAnnouncement(announcementId) {
  if (!announcementId || typeof announcementId !== "string") {
    throw new Error("Valid announcementId is required");
  }

  try {
    const docRef = doc(db, "announcements", announcementId);
    await deleteDoc(docRef);
    console.log(`Announcement with ID ${announcementId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting announcement:", error);
    throw error;
  }
}

/**
 * Retrieves an announcement document by its ID from the `announcements` collection.
 *
 * @param {string} announcementId - The ID of the announcement document to retrieve.
 * @returns {Promise<Object>} Resolves with the announcement object if found.
 * @throws {Error} If the Firestore operation fails or the announcementId is invalid.
 */
export async function getAnnouncementById(announcementId) {
  if (!announcementId || typeof announcementId !== "string") {
    throw new Error("Valid announcementId is required");
  }

  try {
    const docRef = doc(db, "announcements", announcementId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Announcement with ID ${announcementId} does not exist.`);
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error("Error retrieving announcement:", error);
    throw error;
  }
}