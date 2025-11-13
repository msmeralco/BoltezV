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

function IoTMonitor({ appliance, applianceId, allAppliances }) {
    const { user } = useAuth();
    const [showScanner, setShowScanner] = useState(false);
    const [availableSockets, setAvailableSockets] = useState([]);
    const [applianceData, setApplianceData] = useState(appliance);
    const [loading, setLoading] = useState(false);
    const [timerMinutes, setTimerMinutes] = useState('');
    const [editingSocketName, setEditingSocketName] = useState(false);
    const [newSocketName, setNewSocketName] = useState('');
    
    const [clientWattage, setClientWattage] = useState(0);
    const [clientDailyUsage, setClientDailyUsage] = useState(0);
    const [clientMonthlyUsage, setClientMonthlyUsage] = useState(0);
    const [clientDailyReset, setClientDailyReset] = useState(Date.now());
    const [clientMonthlyReset, setClientMonthlyReset] = useState(Date.now());
    const [lastSyncTime, setLastSyncTime] = useState(Date.now());
    
    const wattageIntervalRef = useRef(null);
    const usageIntervalRef = useRef(null);
    const autoOffIntervalRef = useRef(null);

    useEffect(() => {
        if (!user || !applianceId) return;

        const unsubscribe = listenToApplianceIoT(
            user.uid,
            applianceId,
            (data) => {
                if (data) {
                    setApplianceData(data);
                    // Initialize client state from Firebase only on first load
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
                    }
                }
            },
            (error) => {
                console.error('Error listening to appliance:', error);
            }
        );

        return () => unsubscribe();
    }, [user, applianceId]);

    // Update wattage every second (client side)
    // Fluctuations
    useEffect(() => {
        if (applianceData?.iotConnection?.isCurrentlyOn && applianceData?.wattage) {
            const baseWattage = applianceData.wattage;
            
            wattageIntervalRef.current = setInterval(() => {
                const deduction = Math.floor(Math.random() * 11) + 5;
                const actualWattage = baseWattage - deduction;
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
                if (daysSinceReset >= 1) {
                    // Reset daily usage
                    const newDailyResetTime = clientDailyReset + (daysSinceReset * 86400000);
                    setClientDailyUsage(0);
                    setClientDailyReset(newDailyResetTime);
                    console.log('Daily usage reset');
                }
                
                // Check if month has changed
                const resetDate = new Date(clientMonthlyReset);
                const currentDate = new Date(now);
                if (currentDate.getMonth() !== resetDate.getMonth() || 
                    currentDate.getFullYear() !== resetDate.getFullYear()) {
                    // Reset monthly usage
                    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    setClientMonthlyUsage(0);
                    setClientMonthlyReset(monthStart.getTime());
                    console.log('Monthly usage reset');
                }
                
                // Increment usage by 1 second
                setClientDailyUsage(prev => prev + 1);
                setClientMonthlyUsage(prev => prev + 1);
                
                // Check if 12 hours (43200 seconds) have passed since last sync
                const secondsSinceLastSync = Math.floor((now - lastSyncTime) / 1000);
                const twelveHoursInSeconds = 12 * 60 * 60; // 43200 seconds
                
                if (secondsSinceLastSync >= twelveHoursInSeconds) {
                    try {
                        await syncUsageToFirebase(
                            user.uid,
                            applianceId,
                            clientDailyUsage + 1, // +1 for current second
                            clientMonthlyUsage + 1,
                            clientDailyReset,
                            clientMonthlyReset
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
                        alert('Auto-off timer expired. Device turned off.');
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
            
            // Sync current usage when turning off
            if (!newState) {
                await syncUsageToFirebase(
                    user.uid,
                    applianceId,
                    clientDailyUsage,
                    clientMonthlyUsage,
                    clientDailyReset,
                    clientMonthlyReset
                );
                setLastSyncTime(Date.now());
                console.log('Synced to Firebase on turn off');
            } else {
                // When turning on, also sync to update lastUsageStart
                await syncUsageToFirebase(
                    user.uid,
                    applianceId,
                    clientDailyUsage,
                    clientMonthlyUsage,
                    clientDailyReset,
                    clientMonthlyReset
                );
                setLastSyncTime(Date.now());
                console.log('Synced to Firebase on turn on');
            }
            
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
            alert(`Timer set for ${minutes} minutes`);
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
            await toggleIoTAppliance(user.uid, applianceId, false);
            
            // Cancel the timer
            await cancelAutoOffTimer(user.uid, applianceId);
            
            alert('Timer cancelled and device turned off.');
        } catch (error) {
            console.error('Error canceling timer:', error);
            alert('Failed to cancel timer');
        }
    };

    const handleRenameSocket = async () => {
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

    return (
        <div>
            <h4>IoT Monitoring</h4>

            {!isConnected ? (
                <div>
                    <button onClick={handleScanForSockets} disabled={loading}>
                        {loading ? 'Scanning...' : 'Monitor This Device'}
                    </button>

                    {showScanner && availableSockets.length > 0 && (
                        <div>
                            <p>Available Sockets:</p>
                            <ul>
                                {availableSockets.map((socket) => {
                                    const status = getSocketStatus(socket.id);
                                    return (
                                        <li key={socket.id}>
                                            Socket {socket.number} (ID: {socket.id}) - {status}
                                            <button 
                                                onClick={() => handleConnectSocket(socket)} 
                                                disabled={loading || status === 'In Use'}
                                            >
                                                Connect
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <p>
                        Connected to: {iotData.socketName} 
                        {!editingSocketName ? (
                            <button onClick={() => {
                                setEditingSocketName(true);
                                setNewSocketName(iotData.socketName);
                            }}>
                                Rename
                            </button>
                        ) : (
                            <span>
                                <input 
                                    type="text" 
                                    value={newSocketName}
                                    onChange={(e) => setNewSocketName(e.target.value)}
                                />
                                <button onClick={handleRenameSocket}>Save</button>
                                <button onClick={() => setEditingSocketName(false)}>Cancel</button>
                            </span>
                        )}
                    </p>
                    <p>Socket ID: {iotData.socketId} | Socket #{iotData.socketNumber}</p>
                    
                    <p>Actual Wattage: {clientWattage}W (Base: {applianceData.wattage}W)</p>
                    <p>Status: {iotData.isCurrentlyOn ? 'ON' : 'OFF'}</p>
                    
                    <p>Actual Usage Today: {formatUsageTime(clientDailyUsage)}</p>
                    <p>Actual Usage This Month: {formatUsageTime(clientMonthlyUsage)}</p>
                    
                    <button onClick={handleTogglePower}>
                        Turn {iotData.isCurrentlyOn ? 'OFF' : 'ON'}
                    </button>
                    <button onClick={handleDisconnect} disabled={loading}>
                        Disconnect
                    </button>

                    <br /><br />

                    <form onSubmit={handleSetTimer}>
                        <label>
                            Auto-off Timer (minutes):
                            <input 
                                type="number" 
                                value={timerMinutes}
                                onChange={(e) => setTimerMinutes(e.target.value)}
                                placeholder="e.g., 30"
                                min="1"
                            />
                        </label>
                        <button type="submit">Set Timer</button>
                    </form>

                    {iotData.autoOffTimer?.enabled && (
                        <div>
                            <p>Timer Active - Remaining: {getRemainingTime()}</p>
                            <button onClick={handleCancelTimer}>Cancel Timer</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default IoTMonitor;