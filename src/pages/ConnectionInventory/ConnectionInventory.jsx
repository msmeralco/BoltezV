import { useParams } from "react-router-dom";
import useAuth from "../../firebaseServices/auth/useAuth"; // Assumes this provides { user }
import { getUserByUid } from "../../firebaseServices/database/usersFunctions";
import { listenToUserInventory, calculateConsumptionSummary } from "../../firebaseServices/database/inventoryFunctions";
import { useEffect, useState } from "react";
import styles from './ConnectionInventory.module.css';

function ConnectionInventory() {
  const { connectionId } = useParams();
  const { user } = useAuth(); // Get the *currently logged-in* user

  const [connectionUser, setConnectionUser] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAllowed, setIsAllowed] = useState(false); // State to manage privacy
  const [consumptionSummary, setConsumptionSummary] = useState(null); // State for dynamic consumption summary

  // Effect 1: Fetch the static data for the connection (the profile)
  useEffect(() => {
    async function getConnectionUser() {
      if (!connectionId) return;

      setLoading(true);
      setError(null);
      try {
        const connectionUserData = await getUserByUid(connectionId);
        setConnectionUser(connectionUserData);

        // --- Privacy Check ---
        // Check if the current user is allowed to see this inventory
        const privacy = connectionUserData.consumptionSharingPrivacy;
        const myConnections = connectionUserData.connections || {};
        
        // You are allowed if...
        // 1. The profile is "public"
        // 2. The profile is "networkOnly" AND you are in their connection list
        // (Assuming 'user.uid' is the logged-in user)
        if (privacy === "public" || (privacy === "networkOnly" && myConnections[user.uid])) {
          setIsAllowed(true);
        } else {
          setIsAllowed(false);
          setError("This user's inventory is private.");
          setLoading(false);
        }

      } catch (err) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    }

    getConnectionUser();
  }, [connectionId, user]); // Re-run if the connectionId or logged-in user changes

  // Effect 2: Set up the real-time listener for the inventory
  // This effect depends on 'connectionId' and our 'isAllowed' state
  useEffect(() => {
    // Only run if we have a connection and we are allowed to view
    if (!connectionId || !isAllowed) {
      setAppliances([]); // Clear appliances if not allowed
      setConsumptionSummary(null); // Clear consumption summary if not allowed
      return;
    }

    // Set up the callbacks for the listener
    const handleData = (applianceData) => {
      setAppliances(applianceData);
      setLoading(false);

      // Use calculateConsumptionSummary to dynamically update the consumption summary
      const summary = calculateConsumptionSummary(applianceData);
      setConsumptionSummary({
        applianceCount: summary.applianceCount,
        estimatedDailyBill: summary.totalDailyCost,
        estimatedWeeklyBill: summary.totalWeeklyCost,
        estimatedMonthlyBill: summary.totalMonthlyCost,
        topAppliance: summary.topAppliance || "N/A",
      });
    };

    const handleError = (err) => {
      setError(err.message);
      setLoading(false);
    };

    // 1. Call the service function to start the listener
    const unsubscribe = listenToUserInventory(
      connectionId,
      handleData,
      handleError
    );

    // 2. Return the unsubscribe function for cleanup
    return () => {
      unsubscribe();
    };
  }, [connectionId, isAllowed]); // This will run when 'isAllowed' becomes true

  // --- Render Logic ---

  if (loading) {
    return <div>Loading inventory...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  return (
    <div className={styles.inventoryPageContainer}>
      {/* Consumption summary first (matches Inventory layout) */}
      <section className={styles.inventorySection}>
        <h2>Consumption Summary</h2>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <p>Total Appliances</p>
            <span>{consumptionSummary?.applianceCount ?? 0}</span>
          </div>
          <div className={styles.summaryItem}>
            <p>Est. Daily Bill</p>
            <span>PHP {consumptionSummary?.estimatedDailyBill?.toFixed(2) ?? '0.00'}</span>
          </div>
          <div className={styles.summaryItem}>
            <p>Est. Monthly Bill</p>
            <span>PHP {consumptionSummary?.estimatedMonthlyBill?.toFixed(2) ?? '0.00'}</span>
          </div>
          <div className={`${styles.summaryItem} ${styles.topAppliance}`}>
            <p>Top Appliance</p>
            <span>{consumptionSummary?.topAppliance ?? 'N/A'}</span>
          </div>
        </div>
      </section>

      {/* Inventory section */}
      <section className={styles.inventorySection}>
        <div className={styles.inventoryHeader}>
          <h2>{connectionUser ? `${connectionUser.displayName}'s Inventory` : 'Connection Inventory'}</h2>
        </div>

        {appliances.length > 0 ? (
          <div style={{ display: 'grid', gap: '1.25rem' }}>
            {appliances.map((appliance) => (
              <div className={styles.applianceItem} key={appliance.id}>
                {appliance.imageUrl && (
                  <div className={styles.itemImageWrapper}>
                    <img src={appliance.imageUrl} alt={appliance.name} />
                  </div>
                )}

                <div className={styles.itemHeader}>
                  <h3>{appliance.name}</h3>
                  <h6 className={styles.subtitle}>{appliance.type}</h6>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statsItem}>
                    <strong>Wattage:</strong> {appliance.wattage}W
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Usage:</strong> {appliance.hoursPerDay} hours/day
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Consumption:</strong> {appliance.kWhPerDay?.toFixed(2)} kWh/day
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Daily Cost:</strong> PHP {appliance.dailyCost?.toFixed(2)}
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Weekly Cost:</strong> PHP {appliance.weeklyCost?.toFixed(2)}
                  </div>
                  <div className={styles.statsItem}>
                    <strong>Monthly Cost:</strong> PHP {appliance.monthlyCost?.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>This user has no appliances in their inventory.</p>
        )}
      </section>
    </div>
  );
}

export default ConnectionInventory;