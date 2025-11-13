import useAuth from "../../firebaseServices/auth/useAuth";
import styles from './Profile.module.css';

function Profile() {
  const { firestoreUser, firestoreLoading } = useAuth();
  
  if (firestoreLoading) {
    return <div>Loading...</div>;
  }

  if (!firestoreUser) {
    return <div>No user data available.</div>;
  }

  const formatTimestamp = (ts) => {
    if (!ts) return "N/A";
    const date = ts.toDate();
    const timeZone = "Asia/Manila"; // use an IANA zone that is UTC+8
    const datePart = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(date);
    const timePart = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone,
    }).format(date);
    const tzNamePart = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    const tz = tzNamePart ? tzNamePart.replace("GMT", "UTC") : "UTC+8";
    return `${datePart} at ${timePart} ${tz}`;
  };
  

  return (
    <div className={styles.profileContainer}>
      <div className={styles.userInfo}>
        
        <img src={firestoreUser.profileImageUrl} alt="profile" className={styles.profileImage}/>
        <div>
          <h1>{firestoreUser.displayName}</h1>
          <p>Email: {firestoreUser.email}</p>
        
          {firestoreUser.location ? (
            <p>Location: GeoPoint({firestoreUser.location?.latitude}, {firestoreUser.location?.longitude})</p>
          ) : <p>Location: No location indicated</p>}
        </div>
        
        
      </div>
      
      <div className={styles.consumptionInfo}>
        <p>Consumption Sharing Privacy: {firestoreUser.consumptionSharingPrivacy}</p>
        <p>Consumption Summary</p>
        <ul>
          <li>Appliance Count: {firestoreUser.consumptionSummary.applianceCount}</li>
          <li>Estimated Monthly Bill: {firestoreUser.consumptionSummary.estimatedMonthlyBill}</li>
          <li>Top Appliance (by Consumption Cost): {firestoreUser.consumptionSummary.topAppliance}</li>
        </ul>
        <p>Last Report Time: {formatTimestamp(firestoreUser.lastReportTime)}</p>
      </div>
    </div>
  );
}

export default Profile;