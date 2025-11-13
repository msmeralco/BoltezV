import { doc, updateDoc, onSnapshot, collection, Timestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * Generates simulated IoT socket devices (always 5 sockets with static serial numbers)
 * @returns {Array} Array of socket objects
 */
export function generateSimulatedSockets() {
    // Predefined static serial numbers for each socket
    const staticSerialNumbers = [
        '87654321',
        '12345678',
        '98765432',
        '45678901',
        '23456789'
    ];
    
    const sockets = [];
    
    for (let i = 1; i <= 5; i++) {
        sockets.push({
            id: `socket-${staticSerialNumbers[i - 1]}`,
            number: i,
            name: `Socket ${i}`,
            voltage: 220,
            status: 'available'
        });
    }
    
    return sockets;
}

/**
 * Connects an appliance to an IoT socket
 * Updates the appliance document with IoT connection data
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @param {object} socketData - The socket object to connect to
 * @returns {Promise<object>} - Success response
 */
export async function connectApplianceToSocket(userId, applianceId, socketData) {
    if (!userId || !applianceId || !socketData) {
        throw new Error("userId, applianceId, and socketData are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        await updateDoc(applianceDocRef, {
            iotConnection: {
                connected: true,
                socketId: socketData.id,
                socketNumber: socketData.number,
                socketName: socketData.name,
                connectedAt: Timestamp.now(),
                actualWattage: 0,
                isCurrentlyOn: false,
                dailyUsageSeconds: 0,
                monthlyUsageSeconds: 0,
                lastUsageStart: null,
                dailyResetTimestamp: todayStart,
                monthlyResetTimestamp: monthStart,
                lastFirebaseUpdate: Timestamp.now(),
                autoOffTimer: {
                    enabled: false,
                    durationMinutes: 0,
                    startTime: null,
                    endTime: null
                }
            }
        });

        return {
            success: true,
            message: `Appliance connected to ${socketData.name}`,
            socketId: socketData.id
        };
    } catch (error) {
        console.error("Error connecting appliance to socket:", error);
        throw error;
    }
}

/**
 * Renames a socket for an appliance
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @param {string} newName - The new socket name
 * @returns {Promise<object>} - Success response
 */
export async function renameSocket(userId, applianceId, newName) {
    if (!userId || !applianceId || !newName) {
        throw new Error("userId, applianceId, and newName are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        await updateDoc(applianceDocRef, {
            "iotConnection.socketName": newName
        });

        return {
            success: true,
            message: "Socket renamed successfully"
        };
    } catch (error) {
        console.error("Error renaming socket:", error);
        throw error;
    }
}

/**
 * Disconnects an appliance from its IoT socket
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @returns {Promise<object>} - Success response
 */
export async function disconnectApplianceFromSocket(userId, applianceId) {
    if (!userId || !applianceId) {
        throw new Error("userId and applianceId are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        await updateDoc(applianceDocRef, {
            iotConnection: {
                connected: false,
                socketId: null,
                socketNumber: null,
                socketName: null,
                connectedAt: null,
                actualWattage: 0,
                isCurrentlyOn: false,
                dailyUsageSeconds: 0,
                monthlyUsageSeconds: 0,
                lastUsageStart: null,
                dailyResetTimestamp: null,
                monthlyResetTimestamp: null,
                lastFirebaseUpdate: null,
                autoOffTimer: {
                    enabled: false,
                    durationMinutes: 0,
                    startTime: null,
                    endTime: null
                }
            }
        });

        return {
            success: true,
            message: "Appliance disconnected from socket"
        };
    } catch (error) {
        console.error("Error disconnecting appliance from socket:", error);
        throw error;
    }
}

/**
 * Simulates turning on/off an IoT-connected appliance
 * Starts/stops usage tracking and wattage simulation
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @param {boolean} turnOn - true to turn on, false to turn off
 * @returns {Promise<object>} - Success response
 */
export async function toggleIoTAppliance(userId, applianceId, turnOn) {
    if (!userId || !applianceId) {
        throw new Error("userId and applianceId are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        const updateData = {
            "iotConnection.isCurrentlyOn": turnOn
        };

        if (turnOn) {
            updateData["iotConnection.lastUsageStart"] = Timestamp.now();
        } else {
            updateData["iotConnection.lastUsageStart"] = null;
            updateData["iotConnection.actualWattage"] = 0;
        }

        await updateDoc(applianceDocRef, updateData);

        return {
            success: true,
            message: turnOn ? "Appliance turned on" : "Appliance turned off"
        };
    } catch (error) {
        console.error("Error toggling IoT appliance:", error);
        throw error;
    }
}

/**
 * Updates Firebase with accumulated usage data
 * Should be called every 12 hours
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @param {number} dailyUsageSeconds - Current daily usage
 * @param {number} monthlyUsageSeconds - Current monthly usage
 * @param {number} dailyResetTimestamp - Daily reset timestamp
 * @param {number} monthlyResetTimestamp - Monthly reset timestamp
 * @returns {Promise<object>} - Success response
 */
export async function syncUsageToFirebase(userId, applianceId, dailyUsageSeconds, monthlyUsageSeconds, dailyResetTimestamp, monthlyResetTimestamp) {
    if (!userId || !applianceId) {
        throw new Error("userId and applianceId are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        await updateDoc(applianceDocRef, {
            "iotConnection.dailyUsageSeconds": dailyUsageSeconds,
            "iotConnection.monthlyUsageSeconds": monthlyUsageSeconds,
            "iotConnection.dailyResetTimestamp": dailyResetTimestamp,
            "iotConnection.monthlyResetTimestamp": monthlyResetTimestamp,
            "iotConnection.lastFirebaseUpdate": Timestamp.now()
        });

        return {
            success: true,
            message: "Usage data synced to Firebase"
        };
    } catch (error) {
        console.error("Error syncing usage to Firebase:", error);
        throw error;
    }
}

/**
 * Sets an auto-off timer for an appliance
 * The appliance will automatically turn on and then turn off after the specified duration
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @param {number} minutes - Duration in minutes
 * @returns {Promise<object>} - Success response
 */
export async function setAutoOffTimer(userId, applianceId, minutes) {
    if (!userId || !applianceId || !minutes || minutes <= 0) {
        throw new Error("userId, applianceId, and valid minutes are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        const startTime = Timestamp.now();
        const endTime = Timestamp.fromMillis(Date.now() + (minutes * 60 * 1000));

        await updateDoc(applianceDocRef, {
            "iotConnection.isCurrentlyOn": true,
            "iotConnection.lastUsageStart": startTime,
            "iotConnection.autoOffTimer": {
                enabled: true,
                durationMinutes: minutes,
                startTime: startTime,
                endTime: endTime
            }
        });

        return {
            success: true,
            message: `Appliance turned on with auto-off timer set for ${minutes} minutes`,
            endTime: endTime
        };
    } catch (error) {
        console.error("Error setting auto-off timer:", error);
        throw error;
    }
}

/**
 * Cancels the auto-off timer for an appliance
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @returns {Promise<object>} - Success response
 */
export async function cancelAutoOffTimer(userId, applianceId) {
    if (!userId || !applianceId) {
        throw new Error("userId and applianceId are required");
    }

    try {
        const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);
        
        await updateDoc(applianceDocRef, {
            "iotConnection.autoOffTimer": {
                enabled: false,
                durationMinutes: 0,
                startTime: null,
                endTime: null
            }
        });

        return {
            success: true,
            message: "Auto-off timer cancelled"
        };
    } catch (error) {
        console.error("Error canceling auto-off timer:", error);
        throw error;
    }
}

/**
 * Formats seconds into HH:MM:SS format
 * 
 * @param {number} totalSeconds - Total seconds to format
 * @returns {string} - Formatted time string (HH:MM:SS)
 */
export function formatUsageTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Listens to a specific appliance's real-time updates
 * Useful for monitoring IoT connection status and usage
 * 
 * @param {string} userId - The user's UID
 * @param {string} applianceId - The appliance document ID
 * @param {function} onData - Callback function to receive appliance data
 * @param {function} onError - Callback function to handle errors
 * @returns {function} - Unsubscribe function
 */
export function listenToApplianceIoT(userId, applianceId, onData, onError) {
    if (!userId || !applianceId) {
        throw new Error("userId and applianceId are required");
    }

    const applianceDocRef = doc(db, "users", userId, "inventory", applianceId);

    const unsubscribe = onSnapshot(
        applianceDocRef,
        (docSnapshot) => {
            if (docSnapshot.exists()) {
                onData({ id: docSnapshot.id, ...docSnapshot.data() });
            } else {
                onData(null);
            }
        },
        (error) => {
            console.error("Error listening to appliance IoT data:", error);
            onError(error);
        }
    );

    return unsubscribe;
}