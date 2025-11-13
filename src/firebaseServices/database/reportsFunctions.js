import { db } from "../firebaseConfig";
import { collection, orderBy, addDoc, doc, updateDoc, getDoc, GeoPoint, onSnapshot, query, deleteDoc, serverTimestamp, increment } from "firebase/firestore";

import { incrementUserCredibilityScore, decrementUserCredibilityScore } from "./usersFunctions";

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const REPORT_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_REPORT_UPLOAD_PRESET;

/**
 * Add a report document to the `reports` collection.
 *
 * - Validates minimal required fields.
 * - Converts { lat, lng } or { latitude, longitude } to a Firestore GeoPoint.
 * - Adds server timestamp as `timeCreated`.
 * - Sets sensible defaults for `approvalStatus` and `responseStatus`.
 *
 * @param {Object} reportData - Report payload.
 * @param {string} reportData.reporterId - UID of the user creating the report (required).
 * @param {string} [reportData.reporterName] - Display name of the reporter.
 * @param {string} reportData.title - Short title for the report (required).
 * @param {string} [reportData.description] - Detailed description of the report.
 * @param {string} [reportData.imageURL] - Image URL (Cloudinary) attached to the report.
 * @param {Object|GeoPoint} [reportData.location] - Location as a GeoPoint or an object with {lat,lng} or {latitude,longitude}.
 * @param {string} [reportData.approvalStatus] - Optional initial approval status (defaults to "pending").
 * @param {string} [reportData.responseStatus] - Optional initial response status (defaults to "in progress").
 *
 * @returns {Promise<{id: string}>} Resolves with an object containing the created document id.
 * @throws {Error} If required fields are missing or Firestore operation fails.
 */
export async function addReport(reportData) {
	try {
		if (!reportData || typeof reportData !== "object") {
			throw new Error("reportData object is required");
		}

		const { reporterId, reporterName, title, description, imageURL, location, approvalStatus, responseStatus } = reportData;

		if (!reporterId) throw new Error("reporterId is required");
		if (!title) throw new Error("title is required");

		// Normalize location into a Firestore GeoPoint if coordinates provided
		let locationValue = null;
		if (location) {
			// already a GeoPoint
			if (location instanceof GeoPoint) {
				locationValue = location;
			} else if (typeof location.lat === "number" && typeof location.lng === "number") {
				locationValue = new GeoPoint(location.lat, location.lng);
			} else if (typeof location.latitude === "number" && typeof location.longitude === "number") {
				locationValue = new GeoPoint(location.latitude, location.longitude);
			} else {
				// keep null if cannot interpret
				console.warn("addReport: unrecognized location shape, storing null for location");
			}
		}

		const reportDoc = {
			reporterId,
			reporterName: reporterName || null,
			title,
			description: description || "",
			imageURL: imageURL || null,
			location: locationValue,
			timeCreated: serverTimestamp(),
			approvalStatus: approvalStatus || "pending",
			responseStatus: responseStatus || "not started",
      upvoteCount: 0,
      downvoteCount: 0,
		};

		const colRef = collection(db, "reports");
		const docRef = await addDoc(colRef, reportDoc);

		return { id: docRef.id };
	} catch (error) {
		console.error("addReport error:", error);
		throw error;
	}
}

/**
 * Returns all report objects from the "reports" collection in Firestore
 *
 * @param {function(Array)} onData - Callback function to pass the reports array to.
 * @param {function(Error)} onError - Callback function to handle errors.
 * @returns {function} An "unsubscribe" function to detach the listener.lves with an object containing the created document id.
 */
export async function getAllReports(onData, onError) {
	if (typeof onData !== "function") {
		throw new Error("onData callback is required and must be a function");
	}

	const reportsRef = collection(db, "reports");
	// order by timeCreated descending so newest first; fall back to documentId if timeCreated absent
	const q = query(reportsRef, orderBy("timeCreated", "desc"));

	const unsubscribe = onSnapshot(
		q,
		(snapshot) => {
			const reports = [];
			snapshot.forEach((doc) => {
				reports.push({ id: doc.id, ...doc.data() });
			});
			try {
				onData(reports);
			} catch (cbErr) {
				console.error("getAllReports onData callback error:", cbErr);
			}
		},
		(err) => {
			console.error("Error listening to reports: ", err);
			if (typeof onError === "function") onError(err);
		}
	);

    return unsubscribe;
}

/**
 * Deletes a report document from the `reports` collection.
 *
 * @param {string} reportId - The ID of the report document to delete.
 * @returns {Promise<void>} Resolves when the document is successfully deleted.
 * @throws {Error} If the Firestore operation fails or the reportId is invalid.
 */
export async function deleteReport(reportId) {
  if (!reportId || typeof reportId !== "string") {
    throw new Error("Valid reportId is required");
  }

  try {
    const docRef = doc(db, "reports", reportId);
    await deleteDoc(docRef);
    console.log(`Report with ID ${reportId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting report:", error);
    throw error;
  }
}

/**
 * Updates the `responseStatus` field of a report document in the `reports` collection.
 *
 * @param {string} reportId - The ID of the report document to update.
 * @param {string} newStatus - The new response status to set. Possible values: "not started", "in progress", "fixed".
 * @returns {Promise<void>} Resolves when the document is successfully updated.
 * @throws {Error} If the Firestore operation fails or the input parameters are invalid.
 */
export async function updateReportResponseStatus(reportId, newStatus) {
  if (!reportId || typeof reportId !== "string") {
    throw new Error("Valid reportId is required");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new Error("Valid newStatus is required");
  }

  try {
    const docRef = doc(db, "reports", reportId);
    await updateDoc(docRef, { responseStatus: newStatus });
    console.log(`Report with ID ${reportId} updated to responseStatus: ${newStatus}`);
  } catch (error) {
    console.error("Error updating report responseStatus:", error);
    throw error;
  }
}

/**
 * Updates the `approvalStatus` field of a report document in the `reports` collection.
 *
 * @param {string} reportId - The ID of the report document to update.
 * @param {string} newStatus - The new approval status to set. Possible values: "pending", "approved", "rejected".
 * @returns {Promise<void>} Resolves when the document is successfully updated.
 * @throws {Error} If the Firestore operation fails or the input parameters are invalid.
 */
export async function updateReportApprovalStatus(reportId, newStatus) {
  if (!reportId || typeof reportId !== "string") {
    throw new Error("Valid reportId is required");
  }

  if (!newStatus || typeof newStatus !== "string") {
    throw new Error("Valid newStatus is required");
  }

  try {
    const docRef = doc(db, "reports", reportId);
    await updateDoc(docRef, { approvalStatus: newStatus });
    console.log(`Report with ID ${reportId} updated to approvalStatus: ${newStatus}`);
  } catch (error) {
    console.error("Error updating report approvalStatus:", error);
    throw error;
  }
}

/**
 * Retrieves a report document by its ID from the `reports` collection.
 *
 * @param {string} reportId - The ID of the report document to retrieve.
 * @returns {Promise<Object>} Resolves with the report object if found.
 * @throws {Error} If the Firestore operation fails or the reportId is invalid.
 */
export async function getReportById(reportId) {
  if (!reportId || typeof reportId !== "string") {
    throw new Error("Valid reportId is required");
  }

  try {
    const docRef = doc(db, "reports", reportId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Report with ID ${reportId} does not exist.`);
    }

    return { id: docSnap.id, ...docSnap.data() };
  } catch (error) {
    console.error("Error retrieving report:", error);
    throw error;
  }
}

/**
 * Uploads an image file to Cloudinary and retrieves the secure URL of the uploaded image.
 *
 * This function uses the Cloudinary API to upload an image file. The `REPORT_UPLOAD_PRESET`
 * and `CLOUD_NAME` environment variables are used to configure the upload.
 *
 * @param {File} imageFile - The image file to upload. Must be a valid file object.
 * @returns {Promise<string|null>} - A promise that resolves to the secure URL of the uploaded image,
 * or `null` if the upload fails or no file is provided.
 *
 * @throws {Error} - Throws an error if the Cloudinary upload fails.
 */
export async function getReportImageURL(imageFile) {
  if (!imageFile) return null;

  try {
    const form = new FormData();
    form.append("file", imageFile);
    form.append("upload_preset", REPORT_UPLOAD_PRESET);

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

/**
 * Increments the upvote count for a specific report in the `reports` collection.
 *
 * - Updates the `upvoteCount` field in Firestore by incrementing it by 1.
 * - Retrieves the `reporterId` from the report document and increments the user's credibility score.
 *
 * @param {string} reportId - The ID of the report to increment the upvote count for.
 * @returns {Promise<void>} Resolves when the operation is successful.
 * @throws {Error} If the `reportId` is invalid or the Firestore operation fails.
 */
export async function incrementReportUpvoteCount(reportId) {
  if (!reportId) {
    throw new Error("Report ID is required to increment upvote count.");
  }

  try {
    const reportDocRef = doc(db, "reports", reportId);
    await updateDoc(reportDocRef, {
      upvoteCount: increment(1),
    });

    const reportDoc = await getDoc(reportDocRef);
    const reporterId = reportDoc.data().reporterId;

    if (reporterId) {
      await incrementUserCredibilityScore(reporterId); // Await the function to ensure it completes
    } else {
      console.warn(`No reporterId found for report ${reportId}`);
    }

    console.log(`Upvote count incremented for report ${reportId}`);
  } catch (error) {
    console.error("Error incrementing upvote count:", error);
    throw error;
  }
}

/**
 * Increments the downvote count for a specific report in the `reports` collection.
 *
 * - Updates the `downvoteCount` field in Firestore by incrementing it by 1.
 * - Retrieves the `reporterId` from the report document and decrements the user's credibility score.
 *
 * @param {string} reportId - The ID of the report to increment the downvote count for.
 * @returns {Promise<void>} Resolves when the operation is successful.
 * @throws {Error} If the `reportId` is invalid or the Firestore operation fails.
 */
export async function incrementReportDownvoteCount(reportId) {
  if (!reportId) {
    throw new Error("Report ID is required to increment downvote count.");
  }

  try {
    const reportDocRef = doc(db, "reports", reportId);
    await updateDoc(reportDocRef, {
      downvoteCount: increment(1), // Corrected field
    });

    const reportDoc = await getDoc(reportDocRef);
    const reporterId = reportDoc.data().reporterId;

    if (reporterId) {
      await decrementUserCredibilityScore(reporterId); // Await the function to ensure it completes
    } else {
      console.warn(`No reporterId found for report ${reportId}`);
    }

    console.log(`Downvote count incremented for report ${reportId}`);
  } catch (error) {
    console.error("Error incrementing downvote count:", error);
    throw error;
  }
}