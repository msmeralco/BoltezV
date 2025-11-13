import useAuth from "../../firebaseServices/auth/useAuth";
import { useEffect, useState } from "react";
import { updateLocationSharingPrivacy, updateConsumptionSharingPrivacy } from "../../firebaseServices/database/usersFunctions";
import styles from './Profile.module.css';

function Profile() {
  const { firestoreUser, firestoreLoading, signOut, user } = useAuth();
  const [locationPrivacy, setLocationPrivacy] = useState("");
  const [locationUpdateStatus, setLocationUpdateStatus] = useState(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  
  useEffect(() => {
    if (firestoreUser?.locationSharingPrivacy) {
      setLocationPrivacy(firestoreUser.locationSharingPrivacy);
    }
  }, [firestoreUser]);


  if (firestoreLoading) {
    return <div>Loading...</div>;
  }

  if (!firestoreUser) {
    return <div>No user data available.</div>;
  }

  const formatTimestamp = (ts) => {
    if (!ts) return "N/A";
    const date = ts.toDate();
    const timeZone = "Asia/Manila"; 
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


  const formatPrivacySetting = (setting) => {
    if (setting === "private") return "Private";
    if (setting === "connectionsOnly") return "Connections Only";
    if (setting === "public") return "Public";
    return "N/A";
  };

  const handleLocationUpdate = async (e) => {
    e?.preventDefault();
    if (!user?.uid) {
      setLocationUpdateStatus({ success: false, message: "Not authenticated" });
      return;
    }
    try {
      await updateLocationSharingPrivacy(user.uid, locationPrivacy);
      setLocationUpdateStatus({ success: true, message: "Location sharing updated." });
    } catch (err) {
      console.error(err);
      setLocationUpdateStatus({ success: false, message: err?.message || "Failed to update." });
    }
    // clear status after a short delay
    setTimeout(() => setLocationUpdateStatus(null), 3000);
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
          <p>Consumption Sharing Privacy: {firestoreUser.consumptionSharingPrivacy}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className={styles.signoutBtn} onClick={signOut}>Sign Out</button>
            <button className={styles.signoutBtn} onClick={() => setIsSettingsDialogOpen(true)}>Location Sharing</button>
          </div>
        </div>
      </div>
      
      
      {isSettingsDialogOpen && (
        <div className={styles.dialogBackdrop} onClick={() => setIsSettingsDialogOpen(false)}>
          <div className={styles.dialogContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.dialogClose} onClick={() => setIsSettingsDialogOpen(false)}>
              &times;
            </button>
            <h2 className={styles.dialogTitle}>Location Sharing</h2>
            <form className={styles.sharingForm} onSubmit={handleLocationUpdate}>
              <div className={styles.sharingFormLeft}>
                <p className={styles.sharingCurrentSetting}>
                  Current Setting: <strong>{formatPrivacySetting(firestoreUser?.locationSharingPrivacy)}</strong>
                </p>
                <div className={styles.formGroup}>
                  <label htmlFor="privacy-select">Update Privacy</label>
                  <select id="privacy-select" className={styles.formSelect} name="privacySetting" value={locationPrivacy} onChange={(e) => setLocationPrivacy(e.target.value)} required>
                    <option value="">Select a setting</option>
                    <option value="private">Private</option>
                    <option value="connectionsOnly">Connections Only</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
              <button type="submit" className={styles.formButton}>Update Privacy</button>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;