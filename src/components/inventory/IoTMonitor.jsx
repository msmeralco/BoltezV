import React, { useState, useEffect, useRef } from 'react';
import {
    generateSimulatedSockets,
    connectApplianceToSocket,
    disconnectApplianceFromSocket,
    toggleIoTAppliance,
    syncUsageToFirebase,
    formatUsageTime,
    listenToApplianceIoT,
    setAutoOffTimer,
    cancelAutoOffTimer,
    renameSocket
} from "../../firebaseServices/database/iotFunctions";
import useAuth from "../../firebaseServices/auth/useAuth";
// Import the shared styles from the parent's module
import styles from "../../pages/Inventory.module.css";

function IoTMonitor({ appliance, applianceId, allAppliances }) {
    const { user } = useAuth();
    const [showScanner, setShowScanner] = useState(false);
    const [availableSockets, setAvailableSockets] = useState([]);
    const [applianceData, setApplianceData] = useState(appliance);
    const [loading, setLoading] = useState(false);
    const [timerMinutes, setTimerMinutes] = useState('');
    const [editingSocketName, setEditingSocketName] = useState(false);
    const [newSocketName, setNewSocketName] = useState('');

    // Client-side state for wattage and usage tracking
    const [clientWattage, setClientWattage] = useState(0);
    const [clientDailyUsage, setClientDailyUsage] = useState(0);
    const [clientMonthlyUsage, setClientMonthlyUsage] = useState(0);
    const [clientDailyReset, setClientDailyReset] = useState(Date.now());
    const [clientMonthlyReset, setClientMonthlyReset] = useState(Date.now());
    const [lastSyncTime, setLastSyncTime] = useState(Date.now());

    const wattageIntervalRef = useRef(null);
    const usageIntervalRef = useRef(null);
    const autoOffIntervalRef = useRef(null);

    // Reset
    const resetClientState = () => {
        setClientWattage(0);
        setClientDailyUsage(0);
        setClientMonthlyUsage(0);
        const now = Date.now();
        setClientDailyReset(now);
        setClientMonthlyReset(now);
        setLastSyncTime(now);
    }

    // Listen to real-time appliance updates
    useEffect(() => {
        if (!user || !applianceId) return;

        const unsubscribe = listenToApplianceIoT(
            user.uid,
            applianceId,
            (data) => {
                if (data) {
                    setApplianceData(data);

                    // If iotConnection exists, initialize from Firebase
                    if (data.iotConnection) {
                        if (clientDailyUsage === 0 && data.iotConnection.dailyUsageSeconds) {
                            setClientDailyUsage(data.iotConnection.dailyUsageSeconds);
                        }
                        if (clientMonthlyUsage === 0 && data.iotConnection.monthlyUsageSeconds) {
                            setClientMonthlyUsage(data.iotConnection.monthlyUsageSeconds);
                        }
                        if (data.iotConnection.dailyResetTimestamp) {
                            setClientDailyReset(data.iotConnection.dailyResetTimestamp);
                        }
                        if (data.iotConnection.monthlyResetTimestamp) {
                            setClientMonthlyReset(data.iotConnection.monthlyResetTimestamp);
                        }
                    } else {
                        // If iotConnection was deleted, reset all client state
                        setClientWattage(0);
                        setClientDailyUsage(0);
                        setClientMonthlyUsage(0);
                        setClientDailyReset(Date.now());
                        setClientMonthlyReset(Date.now());
                        setLastSyncTime(Date.now());
                    }
                }
            },
            (error) => {
                console.error('Error listening to appliance:', error);
            }
        );

        return () => unsubscribe();
    }, [user, applianceId, clientDailyUsage, clientMonthlyUsage]); // Added dependencies

    // Update wattage every 1 second (client-side only) - deduct 5-15W from base
    useEffect(() => {
        if (applianceData?.iotConnection?.isCurrentlyOn && applianceData?.wattage) {
            const baseWattage = applianceData.wattage;

            wattageIntervalRef.current = setInterval(() => {
                // Generate random deduction between 5 and 15 watts
                const deduction = Math.floor(Math.random() * 11) + 5; // Random 5-15
                const actualWattage = Math.max(0, baseWattage - deduction); // Ensure not negative
                setClientWattage(actualWattage);
            }, 1000);
        } else {
            setClientWattage(0);
            if (wattageIntervalRef.current) {
                clearInterval(wattageIntervalRef.current);
                wattageIntervalRef.current = null;
            }
        }

        return () => {
            if (wattageIntervalRef.current) {
                clearInterval(wattageIntervalRef.current);
            }
        };
    }, [applianceData?.iotConnection?.isCurrentlyOn, applianceData?.wattage]);

    // Update usage time every 1 second (client-side only) - persistent tracking
    useEffect(() => {
        if (applianceData?.iotConnection?.isCurrentlyOn) {
            usageIntervalRef.current = setInterval(async () => {
                const now = Date.now();

                // Check if a full day (24 hours) has passed since last daily reset
                const daysSinceReset = Math.floor((now - clientDailyReset) / 86400000);
                let currentDailyReset = clientDailyReset;
                let currentDailyUsage = clientDailyUsage;

                if (daysSinceReset >= 1) {
                    // Reset daily usage
                    const newDailyResetTime = clientDailyReset + (daysSinceReset * 86400000);
                    currentDailyUsage = 0;
                    currentDailyReset = newDailyResetTime;
                    setClientDailyUsage(0);
                    setClientDailyReset(newDailyResetTime);
                    console.log('Daily usage reset');
                }

                // Check if month has changed
                const resetDate = new Date(clientMonthlyReset);
                const currentDate = new Date(now);
                let currentMonthlyReset = clientMonthlyReset;
                let currentMonthlyUsage = clientMonthlyUsage;

                if (currentDate.getMonth() !== resetDate.getMonth() ||
                    currentDate.getFullYear() !== resetDate.getFullYear()) {
                    // Reset monthly usage
                    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    currentMonthlyUsage = 0;
                    currentMonthlyReset = monthStart.getTime();
                    setClientMonthlyUsage(0);
                    setClientMonthlyReset(monthStart.getTime());
                    console.log('Monthly usage reset');
                }

                // Increment usage by 1 second
                setClientDailyUsage(prev => prev + 1);
                setClientMonthlyUsage(prev => prev + 1);
                currentDailyUsage += 1;
                currentMonthlyUsage += 1;

                // Check if 12 hours (43200 seconds) have passed since last sync
                const secondsSinceLastSync = Math.floor((now - lastSyncTime) / 1000);
                const twelveHoursInSeconds = 12 * 60 * 60; // 43200 seconds

                if (secondsSinceLastSync >= twelveHoursInSeconds) {
                    try {
                        await syncUsageToFirebase(
                            user.uid,
                            applianceId,
                            currentDailyUsage,
                            currentMonthlyUsage,
                            currentDailyReset,
                            currentMonthlyReset
                        );
                        setLastSyncTime(now);
                        console.log('12-hour milestone sync to Firebase');
                    } catch (error) {
                        console.error('Error syncing to Firebase:', error);
                    }
                }
            }, 1000);
        } else {
            if (usageIntervalRef.current) {
                clearInterval(usageIntervalRef.current);
                usageIntervalRef.current = null;
            }
        }

        return () => {
            if (usageIntervalRef.current) {
                clearInterval(usageIntervalRef.current);
            }
        };
    }, [applianceData?.iotConnection?.isCurrentlyOn, clientDailyReset, clientMonthlyReset, clientDailyUsage, clientMonthlyUsage, lastSyncTime, user.uid, applianceId]);

    // Check auto-off timer
    useEffect(() => {
        if (applianceData?.iotConnection?.autoOffTimer?.enabled) {
            autoOffIntervalRef.current = setInterval(async () => {
                const now = Date.now();
                const endTime = applianceData.iotConnection.autoOffTimer.endTime?.toMillis();

                if (endTime && now >= endTime) {
                    try {
                        // Sync before turning off
                        await syncUsageToFirebase(
                            user.uid,
                            applianceId,
                            clientDailyUsage,
                            clientMonthlyUsage,
                            clientDailyReset,
                            clientMonthlyReset
                        );
                        setLastSyncTime(Date.now());
                        await toggleIoTAppliance(user.uid, applianceId, false);
                        await cancelAutoOffTimer(user.uid, applianceId);
                    } catch (error) {
                        console.error('Error auto-turning off device:', error);
                    }
                }
            }, 1000);
        } else {
            if (autoOffIntervalRef.current) {
                clearInterval(autoOffIntervalRef.current);
                autoOffIntervalRef.current = null;
            }
        }

        return () => {
            if (autoOffIntervalRef.current) {
                clearInterval(autoOffIntervalRef.current);
            }
        };
    }, [applianceData?.iotConnection?.autoOffTimer, user, applianceId, clientDailyUsage, clientMonthlyUsage, clientDailyReset, clientMonthlyReset]);

    const handleScanForSockets = () => {
        setLoading(true);
        setTimeout(() => {
            const sockets = generateSimulatedSockets();
            setAvailableSockets(sockets);
            setShowScanner(true);
            setLoading(false);
        }, 500);
    };

    const handleConnectSocket = async (socket) => {
        try {
            setLoading(true);
            await connectApplianceToSocket(user.uid, applianceId, socket);
            setShowScanner(false);
            setAvailableSockets([]);

            // Reset client state to default values on new connection
            resetClientState();
        } catch (error) {
            console.error('Error connecting socket:', error);
            alert('Failed to connect to socket');
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Are you sure you want to disconnect this appliance?')) return;

        try {
            setLoading(true);
            // Sync final usage before disconnecting
            await syncUsageToFirebase(
                user.uid,
                applianceId,
                clientDailyUsage,
                clientMonthlyUsage,
                clientDailyReset,
                clientMonthlyReset
            );
            setLastSyncTime(Date.now());
            await disconnectApplianceFromSocket(user.uid, applianceId);
            resetClientState();
        } catch (error) {
            console.error('Error disconnecting socket:', error);
            alert('Failed to disconnect socket');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePower = async () => {
        try {
            const newState = !applianceData.iotConnection.isCurrentlyOn;

            // Sync current usage when toggling
            await syncUsageToFirebase(
                user.uid,
                applianceId,
                clientDailyUsage,
                clientMonthlyUsage,
                clientDailyReset,
                clientMonthlyReset
            );
            setLastSyncTime(Date.now());
            console.log('Synced to Firebase on toggle');

            await toggleIoTAppliance(user.uid, applianceId, newState);
        } catch (error) {
            console.error('Error toggling appliance:', error);
            alert('Failed to toggle appliance');
        }
    };

    const handleSetTimer = async (e) => {
        e.preventDefault();
        const minutes = parseInt(timerMinutes);

        if (isNaN(minutes) || minutes <= 0) {
            alert('Please enter a valid number of minutes');
            return;
        }

        try {
            await setAutoOffTimer(user.uid, applianceId, minutes);
            setTimerMinutes('');
        } catch (error) {
            console.error('Error setting timer:', error);
            alert('Failed to set timer');
        }
    };

    const handleCancelTimer = async () => {
        try {
            // Sync current usage to Firestore
            await syncUsageToFirebase(
                user.uid,
                applianceId,
                clientDailyUsage,
                clientMonthlyUsage,
                clientDailyReset,
                clientMonthlyReset
            );
            setLastSyncTime(Date.now());
            console.log('Synced to Firebase on cancel timer');

            // Turn off the appliance
            if (applianceData.iotConnection.isCurrentlyOn) {
                await toggleIoTAppliance(user.uid, applianceId, false);
            }

            // Cancel the timer
            await cancelAutoOffTimer(user.uid, applianceId);

        } catch (error) {
            console.error('Error canceling timer:', error);
            alert('Failed to cancel timer');
        }
    };

    const handleRenameSocket = async (e) => {
        e.preventDefault(); // Use form for submission
        if (!newSocketName.trim()) {
            alert('Please enter a valid socket name');
            return;
        }

        try {
            await renameSocket(user.uid, applianceId, newSocketName);
            setEditingSocketName(false);
            setNewSocketName('');
        } catch (error) {
            console.error('Error renaming socket:', error);
            alert('Failed to rename socket');
        }
    };

    const getRemainingTime = () => {
        if (!applianceData?.iotConnection?.autoOffTimer?.enabled) return null;

        const endTime = applianceData.iotConnection.autoOffTimer.endTime?.toMillis();
        if (!endTime) return null;

        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        return formatUsageTime(remaining);
    };

    const getSocketStatus = (socketId) => {
        // Check all appliances to see if socket is in use
        if (!allAppliances || allAppliances.length === 0) return 'Available';

        const usedSocket = allAppliances.find(app =>
            app.iotConnection?.connected && app.iotConnection?.socketId === socketId
        );

        return usedSocket ? 'In Use' : 'Available';
    };

    const isConnected = applianceData?.iotConnection?.connected;
    const iotData = applianceData?.iotConnection;

    // Use a different root element based on connection status
    if (!isConnected) {
        return (
            <div className={styles.monitorContainer}>
                <div className={styles.monitorHeader}>
                    <div>
                        <h3>IoT Monitoring</h3>
                    </div>
                    <div className={styles.statusIndicator}>
                        Not Connected
                    </div>
                </div>
                <button onClick={handleScanForSockets} disabled={loading} className={styles.formButton}>
                    {loading ? 'Scanning...' : 'Scan for Smart Plugs'}
                </button>

                {showScanner && (
                    <div className={styles.socketsListContainer}>
                        <h4>Available Smart Plugs:</h4>
                        <ul className={styles.socketsList}>
                            {availableSockets.length > 0 ? (
                                availableSockets.map((socket) => {
                                    const status = getSocketStatus(socket.id);
                                    return (
                                        <li key={socket.id} className={styles.socketItem}>
                                            <span>Smart Plug {socket.number} - {status}</span>
                                            <button
                                                onClick={() => handleConnectSocket(socket)}
                                                disabled={loading || status === 'In Use'}
                                                className={styles.connectButton}
                                            >
                                                Connect
                                            </button>
                                        </li>
                                    );
                                })
                            ) : (
                                <li className={styles.socketItem}>
                                    <span>No smart plugs found.</span>
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={styles.monitorContainer}>
            <div className={styles.monitorHeader}>
                <div>
                    <h3>{iotData.socketName}</h3>
                </div>
                <div className={`${styles.statusIndicator} ${iotData.isCurrentlyOn ? styles.on : ""}`}>
                    {iotData.isCurrentlyOn ? 'ON' : 'OFF'}
                </div>
            </div>

            <div className={styles.monitorInfo}>
                <p>Smart Plug ID: {iotData.socketId} | Smart Plug #{iotData.socketNumber}</p>
            </div>

            <div className={styles.monitorStats}>
                <p>Actual Wattage: <strong>{clientWattage}W</strong></p>
                <p>Base Wattage: <strong>{applianceData.wattage}W</strong></p>
                <p>Usage Today: <strong>{formatUsageTime(clientDailyUsage)}</strong></p>
                <p>Usage This Month: <strong>{formatUsageTime(clientMonthlyUsage)}</strong></p>
            </div>

            <div className={styles.monitorActions}>
                {!editingSocketName ? (
                    <div className={styles.actionGroup}>
                        <p>Smart Plug Name: <strong>{iotData.socketName}</strong></p>
                        <button onClick={() => {
                            setEditingSocketName(true);
                            setNewSocketName(iotData.socketName);
                        }} className={styles.formButton}>
                            Rename
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleRenameSocket} className={styles.actionGroup}>
                        <input
                            type="text"
                            value={newSocketName}
                            onChange={(e) => setNewSocketName(e.target.value)}
                            className={styles.formInput}
                            required
                        />
                        <div className={styles.editRemoveGroup}>
                            <button type="submit" className={styles.formButton}>Save</button>
                            <button type="button" onClick={() => setEditingSocketName(false)} className={`${styles.formButton} ${styles.buttonDanger}`}>
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <form onSubmit={handleSetTimer} className={styles.actionGroup}>
                    <label>Auto-off Timer:</label>
                    <div className={styles.editRemoveGroup}>
                        <input
                            type="number"
                            value={timerMinutes}
                            onChange={(e) => setTimerMinutes(e.target.value)}
                            placeholder="Minutes"
                            min="1"
                            className={styles.formInput}
                        />
                        <button type="submit" className={styles.formButton}>Set</button>
                    </div>
                </form>

                {iotData.autoOffTimer?.enabled && (
                    <div className={styles.actionGroup}>
                        <p>Timer Active: <strong>{getRemainingTime()} left</strong></p>
                        <button onClick={handleCancelTimer} className={`${styles.formButton} ${styles.buttonDanger}`}>
                            Cancel Timer
                        </button>
                    </div>
                )}
            </div>

            <div className={styles.monitorControls}>
                <button onClick={handleTogglePower} className={styles.formButton}>
                    Turn {iotData.isCurrentlyOn ? 'OFF' : 'ON'}
                </button>
                <button onClick={handleDisconnect} disabled={loading} className={`${styles.formButton} ${styles.buttonDanger}`}>
                    Disconnect
                </button>
            </div>

        </div>
    );
}

export default IoTMonitor;