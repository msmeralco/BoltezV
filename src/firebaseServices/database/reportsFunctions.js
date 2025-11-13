import { db } from "../firebaseConfig";
import { where, collection, orderBy, addDoc, doc, updateDoc, getDoc, GeoPoint, deleteField, onSnapshot, query, documentId, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";

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
			responseStatus: responseStatus || "in progress",
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
