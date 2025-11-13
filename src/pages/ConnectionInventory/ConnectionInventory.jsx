import { useParams } from "react-router-dom";
import useAuth from "../../firebaseServices/auth/useAuth"; // Assumes this provides { user }
import { getUserByUid } from "../../firebaseServices/database/usersFunctions";
import { listenToUserInventory, calculateConsumptionSummary } from "../../firebaseServices/database/inventoryFunctions";
import { useEffect, useState, useMemo } from "react";
import { ResponsivePie } from "@nivo/pie";
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

  const pieData = useMemo(() => {
    if (!appliances || appliances.length === 0) {
      return [{ id: "No Data", label: "No Data", value: 1, color: "#cccccc" }];
    }
    return appliances.map((app) => ({
      id: app.name,
      label: app.name,
      value: parseFloat(app.monthlyCost?.toFixed(2) || 0),
    }));
  }, [appliances]);


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

        {/* Same structure and inline styles as Inventory to ensure identical layout */}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "1.5rem", width: "100%", alignItems: "center" }}>
          <div style={{ height: "350px", minWidth: "300px", flex: "1 1 60%", boxSizing: "border-box" }}>
            <ResponsivePie
              data={pieData}
              colors={{ scheme: "spectral" }}
              margin={{ top: 20, right: 140, bottom: 20, left: 20 }}
              innerRadius={0.5}
              padAngle={0.7}
              cornerRadius={3}
              activeOuterRadiusOffset={8}
              borderWidth={1}
              borderColor={{ from: "color", modifiers: [["darker", 0.2]] }}
              arcLinkLabelsSkipAngle={10}
              arcLinkLabelsTextColor="#333333"
              arcLinkLabelsThickness={2}
              arcLinkLabelsColor={{ from: "color" }}
              arcLabelsSkipAngle={10}
              arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
              legends={[{ anchor: "right", direction: "column", justify: false, translateX: 120, translateY: 0, itemsSpacing: 2, itemWidth: 100, itemHeight: 20, itemTextColor: "#999", itemDirection: "left-to-right", itemOpacity: 1, symbolSize: 18, symbolShape: "circle", effects: [{ on: "hover", style: { itemTextColor: "#000" } }] }]}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: "1 1 30%", minWidth: "200px", boxSizing: "border-box" }}>
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