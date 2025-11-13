import { useParams } from "react-router-dom";
import useAuth from "../../firebaseServices/auth/useAuth"; // Assumes this provides { user }
import { getUserByUid } from "../../firebaseServices/database/usersFunctions";
import { listenToUserInventory, calculateConsumptionSummary } from "../../firebaseServices/database/inventoryFunctions";
import { useEffect, useState } from "react";
import styles from './ConnectionInventory.module.css';

function ConnectionInventory() {
  const { connectionId } = useParams();
  const { user } = useAuth(); 

  const [connectionUser, setConnectionUser] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAllowed, setIsAllowed] = useState(false); 
  const [consumptionSummary, setConsumptionSummary] = useState(null); 

  useEffect(() => {
    async function getConnectionUser() {
      if (!connectionId) return;

      setLoading(true);
      setError(null);
      try {
        const connectionUserData = await getUserByUid(connectionId);
        setConnectionUser(connectionUserData);

        const privacy = connectionUserData.consumptionSharingPrivacy;
        const myConnections = connectionUserData.connections || {};
        
        if (privacy === "public" || (privacy === "connectionsOnly" && myConnections[user.uid])) {
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
  }, [connectionId, user]); 


  useEffect(() => {

    if (!connectionId || !isAllowed) {
      setAppliances([]);
      setConsumptionSummary(null);
      return;
    }

    const handleData = (applianceData) => {
      setAppliances(applianceData);
      setLoading(false);

      
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

    const unsubscribe = listenToUserInventory(
      connectionId,
      handleData,
      handleError
    );

    return () => {
      unsubscribe();
    };
  }, [connectionId, isAllowed]); 


  if (loading) {
    return <div>Loading inventory...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  return (
    <div className={styles.inventoryPageContainer}>
      
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