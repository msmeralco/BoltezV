import { useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import { db } from "../firebaseConfig";
import { where, collection, addDoc, doc, updateDoc, getDoc, GeoPoint, deleteField, onSnapshot, query, documentId, getDocs, increment } from "firebase/firestore";
import defaultPfp from "../../assets/default-pfp.png"
import { addApplianceToInventory } from "./inventoryFunctions";

/**
 * Fetches a user document from the Firestore `users` collection by UID.
 * @param {string} uid - The UID of the user to fetch.
 * @returns {Promise<object>} - A promise that resolves to the user object, including the UID and all fields.
 */
export async function getUserByUid(userId) {
  if (!userId) {
    throw new Error("UID is required to fetch user data.");
  }

  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
 
    if (!userDoc.exists()) {
      throw new Error(`User with UID ${userId} does not exist.`);
    }

    return { userId, ...userDoc.data() };
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

/**
 * Connects two users with each other by their UID.
 * @param {string} uid1 - The UID of the first user.
 * @param {string} uid2 - The UID of the second user.
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the connection.
 *   - `connectedUsers` (string[]): An array of the connected user UIDs.
 */
export async function connectTwoUsers(uid1, uid2) {
  if (!uid1 || !uid2) {
    throw new Error("User ID 1 and User ID 2 are required to connect two users");
  }

  if (uid1 === uid2) {
    throw new Error("User IDs must not be equal to each other");
  }

  try {
    const user1DocRef = doc(db, "users", uid1);
    const user2DocRef = doc(db, "users", uid2);

    await updateDoc(user1DocRef, {
      [`connections.${uid2}`]: true,
      [`pendingRequestsIn.${uid2}`]: deleteField(),
      [`pendingRequestsOut.${uid2}`]: deleteField(),  
    })

    await updateDoc(user2DocRef, {
      [`connections.${uid1}`]: true,
      [`pendingRequestsIn.${uid1}`]: deleteField(),
      [`pendingRequestsOut.${uid1}`]: deleteField(),  
    })

    return {
      success: true,
      message: `Users ${uid1} and ${uid2} are now connected.`,
      connectedUsers: [uid1, uid2],
    };
  } catch (error) {
    console.error("Error connecting two users: ", error);
    throw error;
  }
}

/**
 * Disconnects two users from each other by their UID.
 * @param {string} uid1 - The UID of the first user.
 * @param {string} uid2 - The UID of the second user.
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the disconnection.
 *   - `disconnectedUsers` (string[]): An array of the disconnected user UIDs.
 */
export async function disconnectTwoUsers(uid1, uid2) {
  if (!uid1 || !uid2) {
    throw new Error("User ID 1 and User ID 2 are required to disconnect two users");
  }

  if (uid1 === uid2) {
    throw new Error("User IDs must not be equal to each other");
  }

  try {
    const user1DocRef = doc(db, "users", uid1);
    const user2DocRef = doc(db, "users", uid2);

    const user1Doc = await getDoc(user1DocRef);
    const user2Doc = await getDoc(user2DocRef);

    if (!user1Doc.exists() || !user2Doc.exists()) {
      throw new Error("One or both users do not exist.");
    }

    const user1Connections = user1Doc.data().connections || {};
    const user2Connections = user2Doc.data().connections || {};

    if (!user1Connections[uid2] || !user2Connections[uid1]) {
      throw new Error("The users are not connected.");
    }

    await updateDoc(user1DocRef, {
      [`connections.${uid2}`]: deleteField(),
      [`pendingRequestsOut.${uid2}`]: deleteField(),
      [`pendingRequestsIn.${uid2}`]: deleteField(),
    });

    await updateDoc(user2DocRef, {
      [`connections.${uid1}`]: deleteField(),
      [`pendingRequestsOut.${uid1}`]: deleteField(),
      [`pendingRequestsIn.${uid1}`]: deleteField(),
    });

    return {
      success: true,
      message: `Users ${uid1} and ${uid2} are now disconnected.`,
      disconnectedUsers: [uid1, uid2],
    };
  } catch (error) {
    console.error("Error disconnecting two users: ", error);
    throw error;
  }
}

/**
 * Fetches all connection UIDs of a user from the Firestore `users` collection.
 * @param {string} uid - The UID of the user whose connections are to be fetched.
 * @returns {Promise<string[]>} - A promise that resolves to an array of connection UIDs.
 * @throws {Error} - Throws an error if the UID is not provided or the user does not exist.
 */
export async function getAllUserConnections(uid) {
  if (!uid) {
    throw new Error("UID is required to fetch user connections.");
  }

  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error(`User with UID ${uid} does not exist.`);
    }

    const connections = userDoc.data().connections || {};
    return Object.keys(connections);
  } catch (error) {
    console.error("Error fetching user connections:", error);
    throw error;
  }
}

/**
 * Listens to a user's connections and their real-time profile data.
 *
 * @param {string} userId - The UID of the user to listen for.
 * @param {function(Array)} onData - Callback function to pass the connections data to.
 * @param {function(Error)} onError - Callback function to handle errors.
 * @returns {function} A single "unsubscribe" function that detaches all listeners.
 */
export function listenToUserConnections(userId, onData, onError) {
  // This will hold the unsubscribe function for the *inner* listener
  let unsubscribeFromFriends = () => {};

  // --- Outer Listener: Listen to the current user's document ---
  const userDocRef = doc(db, "users", userId);
  const unsubscribeFromUser = onSnapshot(
    userDocRef,
    (userDoc) => {
      if (!userDoc.exists()) {
        console.error("Current user document does not exist!");
        onData([]); // Pass an empty array and stop loading
        return;
      }

      // Get the list of friend UIDs
      const connections = userDoc.data().connections || {};
      const connectionIds = Object.keys(connections);

      // --- Inner Listener: Listen to all friend documents ---
      unsubscribeFromFriends(); // Unsubscribe from the previous listener

      if (connectionIds.length > 0) {
        const friendsQuery = query(
          collection(db, "users"),
          where(documentId(), "in", connectionIds)
        );

        unsubscribeFromFriends = onSnapshot(
          friendsQuery,
          (friendsSnapshot) => {
            const details = [];
            friendsSnapshot.forEach((friendDoc) => {
              details.push({ id: friendDoc.id, ...friendDoc.data() });
            });
            onData(details);
          },
          (error) => {
            console.error("Error listening to friends' documents: ", error);
            onError(error);
          }
        );
      } else {
        onData([]); // User has no friends
      }
    },
    (error) => {
      console.error("Error listening to user document: ", error);
      onError(error);
    }
  );

  return () => {
    unsubscribeFromUser();
    unsubscribeFromFriends();
  };
}

/**
 * Fetches all users' details limited to id, displayName, profileImageUrl, credibilityScore
 * and listens for real-time updates to the current user's connections.
 *
 * @param {string} userId - The UID of the user to listen for.
 * @param {function(Array)} onData - Callback function to pass the non-connections data to.
 * @param {function(Error)} onError - Callback function to handle errors.
 * @returns {function} A single "unsubscribe" function that detaches all listeners.
 */
export function getAllUserNonConnectionsDetails(userId, onData, onError) {
  if (!userId) {
    throw new Error("UID is required to fetch user's non-connections' details.");
  }

  const usersCollectionRef = collection(db, "users");
  const userDocRef = doc(db, "users", userId);

  // Subscribe to the current user's document
  const unsubscribe = onSnapshot(
    userDocRef,
    async (userDoc) => {
      if (!userDoc.exists()) {
        console.error("Current user document does not exist!");
        onData([]);
        return;
      }

      try {
        const connections = userDoc.data().connections || {};
        const connectionIds = Object.keys(connections);

        // Query to get all users not in the connections list
        const nonConnectionsQuery = query(
          usersCollectionRef,
          where(documentId(), "not-in", [...connectionIds, userId]) // Exclude connections and the current user
        );

        const nonConnectionsQuerySnapshot = await getDocs(nonConnectionsQuery);
        const nonConnectionsDetails = [];

        nonConnectionsQuerySnapshot.forEach((doc) => {
          const data = doc.data();
          nonConnectionsDetails.push({
            id: doc.id,
            displayName: data.displayName,
            profileImageUrl: data.profileImageUrl,
            credibilityScore: data.credibilityScore,
          });
        });

        onData(nonConnectionsDetails);
      } catch (err) {
        console.error("Error fetching non-connections details:", err);
        onError(err);
      }
    },
    (error) => {
      console.error("Error listening to user document:", error);
      onError(error);
    }
  );

  return () => {
    unsubscribe();
  };
}

/**
 * NEW, ROBUST FUNCTION
 * Listens to *all* users and separates them into real-time lists
 * of connections and non-connections.
 *
 * @param {string} userId - The UID of the currently logged-in user.
 * @param {function(Array)} onConnections - Callback to update connections list.
 * @param {function(Array)} onNonConnections - Callback to update non-connections list.
 * @param {function(Error)} onError - Callback for errors.
 * @returns {function} A single "unsubscribe" function.
 */
export function listenToUserFeed(
  userId,
  onConnections,
  onNonConnections,
  onError
) {
  const usersCollectionRef = collection(db, "users");

  // We listen to the entire 'users' collection.
  // This is normally an anti-pattern, but for a "find friends"
  // feature, it's necessary.
  const unsubscribe = onSnapshot(
    usersCollectionRef,
    async (snapshot) => {
      try {
        // --- 1. Get the current user's data first ---
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          throw new Error("Current user not found in 'users' collection.");
        }
        const myData = userDoc.data();
        const myConnectionIds = Object.keys(myData.connections || {});

        // --- 2. Process all other users ---
        const connections = [];
        const nonConnections = [];

        snapshot.forEach((doc) => {
          const docId = doc.id;
          // Skip the current user
          if (docId === userId) {
            return;
          }

          const userData = doc.data();

          // Check if this user is in our connection list
          if (myConnectionIds.includes(docId)) {
            connections.push({ id: docId, ...userData });
          } else {
            // This is a non-connection, pass the full data
            nonConnections.push({ id: docId, ...userData });
          }
        });

        // --- 3. Sorting connections and nonConnConnections ---
        connections.sort((a, b) => (
          (b.credibilityScore || 0) - (a.credibilityScore || 0)
        ))

        nonConnections.sort((a, b) => (
          (b.credibilityScore || 0) - (a.credibilityScore || 0)
        ))

        // --- 4. Pass the data back to the React component ---
        onConnections(connections);
        onNonConnections(nonConnections);
      } catch (err) {
        onError(err);
      }
    },
    (error) => {
      // Handle snapshot errors
      console.error("Error listening to user feed: ", error);
      onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Sends a connection request from the sender user to the receiver user.
 *
 * @param {string} senderId - The UID of the user sending the request.
 * @param {string} receiverId - The UID of the user receiving the request.
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the connection request.
 *   - `users` (string[]): An array of the involved user UIDs.
 * @throws {Error} - Throws an error if validation fails or the operation encounters an issue.
 */
export async function sendConnectionRequest(senderId, receiverId) {
  if (!senderId || !receiverId) {
    throw new Error("Connection Request Error: senderId and receiverId must be present");
  }
  if (senderId === receiverId) {
    throw new Error("Connection Request Error: senderId and receiverId must be different users.");
  }

  try {
    const senderDocRef = doc(db, "users", senderId);
    const receiverDocRef = doc(db, "users", receiverId);

    // Fetch sender and receiver documents
    const [senderDoc, receiverDoc] = await Promise.all([
      getDoc(senderDocRef),
      getDoc(receiverDocRef),
    ]);

    if (!senderDoc.exists() || !receiverDoc.exists()) {
      throw new Error("One or both users do not exist.");
    }

    const senderData = senderDoc.data();
    const receiverData = receiverDoc.data();

    // Validation: Check if users are already connected
    if (senderData.connections?.[receiverId] || receiverData.connections?.[senderId]) {
      throw new Error("Users are already connected.");
    }

    // Validation: Check if a request has already been made
    if (senderData.pendingRequestsOut?.[receiverId] || receiverData.pendingRequestsIn?.[senderId]) {
      throw new Error("A connection request has already been made between these users.");
    }

    // Update sender's pendingRequestsOut and receiver's pendingRequestsIn
    await Promise.all([
      updateDoc(senderDocRef, {
        [`pendingRequestsOut.${receiverId}`]: true,
      }),
      updateDoc(receiverDocRef, {
        [`pendingRequestsIn.${senderId}`]: true,
      }),
    ]);

    return {
      success: true,
      message: `User ${senderId} sent a connection request to ${receiverId}`,
      users: [senderId, receiverId],
    };
  } catch (error) {
    console.error("Error requesting connection between users: ", error);
    throw error;
  }
}

/**
 * Checks if two users are either connected or have a pending connection request between them.
 *
 * @param {string} userId1 - The UID of the first user.
 * @param {string} userId2 - The UID of the second user.
 * @returns {Promise<boolean>} - A promise that resolves to true if the users are connected or have a pending request, otherwise false.
 * @throws {Error} - Throws an error if either user does not exist.
 */
export async function checkUsersIfConnectedOrRequested(userId1, userId2) {
  if (!userId1 || !userId2) {
    throw new Error("Both userId1 and userId2 are required.");
  }

  try {
    const user1DocRef = doc(db, "users", userId1);
    const user2DocRef = doc(db, "users", userId2);

    const [user1Doc, user2Doc] = await Promise.all([
      getDoc(user1DocRef),
      getDoc(user2DocRef),
    ]);

    if (!user1Doc.exists() || !user2Doc.exists()) {
      throw new Error("One or both users do not exist.");
    }

    const user1Data = user1Doc.data();
    const user2Data = user2Doc.data();

    // Check if users are connected
    if (user1Data.connections?.[userId2] || user2Data.connections?.[userId1]) {
      return true;
    }

    // Check if there is a pending request between the users
    if (
      user1Data.pendingRequestsOut?.[userId2] ||
      user1Data.pendingRequestsIn?.[userId2] ||
      user2Data.pendingRequestsOut?.[userId1] ||
      user2Data.pendingRequestsIn?.[userId1]
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking connection or request status between users:", error);
    throw error;
  }
}

// ========== DUMMIES FOR TESTING ==========

/**
 * Adds a Dummy User with Inventory
 * @param {string} name - The name of the user to add.
 * @returns {Promise<object>} - The added user id and name.
 */
export async function addDummyUserWithInventory(name) {
  try {
    const profileImageUrl = defaultPfp;
    const location = new GeoPoint(14.6735104, 120.9663488);

    // Add the user document
    const userRef = await addDoc(collection(db, "users"), {
      actualMonthlyBill: 0,
      connections: {},
      consumptionSharingPrivacy: 'public',
      consumptionSummary: {
        isCalculatedBefore: false,
        applianceCount: 0,
        estimatedDailyBill: 0,
        estimatedWeeklyBill: 0,
        estimatedMonthlyBill: 0,
        topAppliance: '',
      },
      credibilityScore: 0,
      displayName: `Dummy ${name}`,
      email: `${name.toLowerCase()}@dummyemail.com`,
      lastReportTime: null,
      location,
      pendingRequestsIn: {},
      pendingRequestsOut: {},
      profileImageUrl,
      userRole: 'regular',
      locationSharingPrivacy: 'public',
    });

    const laptopUrl = "https://res.cloudinary.com/ddr9shttr/image/upload/v1762953510/laptop_vlww85.jpg";
    const refrigeratorUrl = "https://res.cloudinary.com/ddr9shttr/image/upload/v1762953510/refrigerator_rzyvyx.jpg";
    const electricFanUrl = "https://res.cloudinary.com/ddr9shttr/image/upload/v1762953511/electricFan_prx3rw.jpg";
    const riceCookerUrl = "https://res.cloudinary.com/ddr9shttr/image/upload/v1762953510/riceCooker_nrojwo.jpg";
    const airconUrl = "https://res.cloudinary.com/ddr9shttr/image/upload/v1762953510/aircon_q5czsb.jpg";
    
    // Add inventory subcollection with 5 appliances
    const inventory = [
      { name: "Air Conditioner", type: "Air Conditioner", wattage: 1200, hoursPerDay: 8, daysPerWeek: 7, weeksPerMonth: 4, specificDaysUsed: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }, addedBy: "manual", imageUrl: airconUrl },
      { name: "Electric Fan", type: "Electric Fan", wattage: 75, hoursPerDay: 10, daysPerWeek: 7, weeksPerMonth: 4, specificDaysUsed: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }, addedBy: "manual", imageUrl: electricFanUrl },
      { name: "Laptop", type: "Laptop", wattage: 60, hoursPerDay: 6, daysPerWeek: 5, weeksPerMonth: 4, specificDaysUsed: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false }, addedBy: "manual", imageUrl: laptopUrl },
      { name: "Refrigerator", type: "Refrigerator", wattage: 150, hoursPerDay: 24, daysPerWeek: 7, weeksPerMonth: 4, specificDaysUsed: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }, addedBy: "manual", imageUrl: refrigeratorUrl },
      { name: "Rice Cooker", type: "Rice Cooker", wattage: 700, hoursPerDay: 1, daysPerWeek: 7, weeksPerMonth: 4, specificDaysUsed: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true }, addedBy: "manual", imageUrl: riceCookerUrl },
    ];

    for (const appliance of inventory) {
      await addApplianceToInventory(userRef.id, appliance);
    }

    return { id: userRef.id, name };
  } catch (err) {
    console.error("Error adding dummy user with inventory:", err);
    throw err;
  }
}

/**
 * Updates the `consumptionSharingPrivacy` field in a user's document.
 *
 * @param {string} userId - The UID of the user whose privacy setting is to be updated.
 * @param {string} newSetting - The new privacy setting. Possible values: "private", "connectionsOnly", "public".
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the update.
 * @throws {Error} - Throws an error if the userId or newSetting is invalid, or if the update fails.
 */
export async function updateConsumptionSharingPrivacy(userId, newSetting) {
  if (!userId || !newSetting) {
    throw new Error("Both userId and newSetting are required.");
  }

  const validSettings = ["private", "connectionsOnly", "public"];
  if (!validSettings.includes(newSetting)) {
    throw new Error(`Invalid privacy setting: ${newSetting}. Valid options are: ${validSettings.join(", ")}`);
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      consumptionSharingPrivacy: newSetting,
    });

    return {
      success: true,
      message: `Privacy setting updated to '${newSetting}' for user ${userId}.`,
    };
  } catch (error) {
    console.error("Error updating consumptionSharingPrivacy:", error);
    throw error;
  }
}

/**
 * Updates the `locationSharingPrivacy` field in a user's document.
 *
 * @param {string} userId - The UID of the user whose privacy setting is to be updated.
 * @param {string} newSetting - The new privacy setting. Possible values: "private", "connectionsOnly", "public".
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the update.
 * @throws {Error} - Throws an error if the userId or newSetting is invalid, or if the update fails.
 */
export async function updateLocationSharingPrivacy(userId, newSetting) {
  if (!userId || !newSetting) {
    throw new Error("Both userId and newSetting are required.");
  }

  const validSettings = ["private", "connectionsOnly", "public"];
  if (!validSettings.includes(newSetting)) {
    throw new Error(`Invalid privacy setting: ${newSetting}. Valid options are: ${validSettings.join(", ")}`);
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      locationSharingPrivacy: newSetting,
    });

    return {
      success: true,
      message: `Privacy setting updated to '${newSetting}' for user ${userId}.`,
    };
  } catch (error) {
    console.error("Error updating locationSharingPrivacy:", error);
    throw error;
  }
}

/**
 * Increments the `credibilityScore` field of a user document in the `users` collection by 1.
 *
 * @param {string} userId - The UID of the user whose credibility score is to be incremented.
 * @returns {Promise<void>} Resolves when the operation is successful.
 * @throws {Error} If the userId is invalid or the Firestore operation fails.
 */
export async function incrementUserCredibilityScore(userId) {
  if (!userId) {
    throw new Error("User ID is required to increment credibility score.");
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      credibilityScore: increment(1),
    });
    console.log(`Credibility score incremented for user ${userId}`);
  } catch (error) {
    console.error("Error incrementing credibility score:", error);
    throw error;
  }
}

/**
 * Updates the `credibilityScore` field of a user document in the `users` collection by decrementing it by 1.
 *
 * @param {string} userId - The UID of the user whose credibility score is to be decremented.
 * @returns {Promise<void>} Resolves when the operation is successful.
 * @throws {Error} If the userId is invalid or the Firestore operation fails.
 */
export async function decrementUserCredibilityScore(userId) {
  if (!userId) {
    throw new Error("User ID is required to increment credibility score.");
  }

  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      throw new Error("User does not exist.");
    }

    const currentScore = userDoc.data().credibilityScore || 0;

    if (currentScore > 0) {
      await updateDoc(userDocRef, {
        credibilityScore: increment(-1),
      });
      console.log(`Credibility score decremented for user ${userId}`);
    } else {
      console.log(`Credibility score for user ${userId} is already at the minimum value of 0.`);
    }
  } catch (error) {
    console.error("Error decrementing credibility score:", error);
    throw error;
  }
}

/**
 * Updates the `location` field in a user's document.
 *
 * @param {string} userId - The UID of the user whose location is to be updated.
 * @param {GeoPoint} geopoint - The Firestore GeoPoint object containing latitude and longitude.
 * @returns {Promise<object>} - A promise that resolves to an object containing:
 *   - `success` (boolean): Indicates if the operation was successful.
 *   - `message` (string): A message confirming the update.
 *   - `location` (object): The updated location object with latitude and longitude.
 * @throws {Error} - Throws an error if the userId or geopoint is invalid, or if the update fails.
 */
export async function updateUserLocation(userId, geopoint) {
  if (!userId) {
    throw new Error("userId is required to update location.");
  }

  if (!(geopoint instanceof GeoPoint)) {
    throw new Error("geopoint must be a valid Firestore GeoPoint object.");
  }

  try {
    const userDocRef = doc(db, "users", userId);

    await updateDoc(userDocRef, {
      location: geopoint,
    });

    return {
      success: true,
      message: `Location updated successfully for user ${userId}.`,
      location: `[${geopoint.latitude}° N, ${geopoint.longitude}° E]`,
    };
  } catch (error) {
    console.error("Error updating user location:", error);
    throw error;
  }
}