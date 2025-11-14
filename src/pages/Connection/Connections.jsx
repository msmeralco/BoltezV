import useAuth from "../../firebaseServices/auth/useAuth";
import { useEffect, useState } from "react";
import {
  listenToUserFeed,
  sendConnectionRequest,
  connectTwoUsers,
  disconnectTwoUsers,
} from "../../firebaseServices/database/usersFunctions";
import { Link } from "react-router-dom";
import styles from './Connections.module.css';

function Connections() {
  const { user } = useAuth(); 
  const [connectionsDetails, setConnectionsDetails] = useState([]);
  const [nonConnectionsDetails, setNonConnectionsDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [findConnectionsLoading, setFindConnectionsLoading] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [disconnectionFeedback, setDisconnectionFeedback] = useState({ connectionId: null, message: "", success: null });

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      setConnectionsDetails([]);
      setNonConnectionsDetails([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Call new unified listener
    const unsubscribe = listenToUserFeed(
      user.uid,
      (connections) => {
        setConnectionsDetails(connections);
        setLoading(false); 
      },
      (nonConnections) => {
        setNonConnectionsDetails(nonConnections);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSendRequest = async (receiverId) => {
    try {
      await sendConnectionRequest(user.uid, receiverId);
      console.log(`Connection request sent to ${receiverId}`);
    } catch (error) {
      console.error("Error sending connection request:", error);
    }
  };

  const handleRemoveConnection = async (connectionId) => {
    if (!user?.uid) return;
    setDisconnectingId(connectionId);
    setDisconnectionFeedback({ connectionId: null, message: "", success: null });
    try {
      const result = await disconnectTwoUsers(user.uid, connectionId);
      // result: { success, message, disconnectedUsers }
      setDisconnectionFeedback({ connectionId, message: result.message || "Disconnected.", success: !!result.success });
      if (result.success) {
        // Optimistically update local list - listener will also update
        setConnectionsDetails((prev) => prev.filter((c) => c.id !== connectionId));
      }
    } catch (err) {
      setDisconnectionFeedback({ connectionId, message: err?.message || "Failed to disconnect.", success: false });
      console.error("Failed to disconnect users:", err);
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleConfirmRequest = async (senderId) => {
    try {
      await connectTwoUsers(senderId, user.uid);
      console.log(`Connection confirmed with ${senderId}`);
    } catch (error) {
      console.error("Error confirming connection request:", error);
    }
  };

  const getButtonState = (nonConnection) => {
    const iSentThemRequest = nonConnection.pendingRequestsIn?.[user.uid];
    const theySentMeRequest = nonConnection.pendingRequestsOut?.[user.uid];

    if (theySentMeRequest) {
      return (
        <button className={styles.confirmBtn} onClick={() => handleConfirmRequest(nonConnection.id)}>
          Confirm Request
        </button>
      );
    } else if (iSentThemRequest) {
      return <button className={styles.requestedBtn} disabled >Requested</button>;
    } else {
      return (
        <button className={styles.requestBtn} onClick={() => handleSendRequest(nonConnection.id)}>
          Send Request
        </button>
      );
    }
  };

  if (loading) {
    return <div>Loading connections...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>Error: {error}</div>;
  }

  if (!user) {
    return <div>Please log in to see your connections.</div>;
  }
  

  return (
    <div className={styles.connectionsContainer}>
      <div className={styles.headerConnection}>
        <h1>Your Connections</h1>
        <button className={styles.findButton} onClick={() => setFindConnectionsLoading(true)}>Find Connections</button>
      </div>
      {connectionsDetails.length === 0 ? (
        <p>You haven't added any connections yet.</p>
      ) : (
        <div className={styles.connectionList}>
          {connectionsDetails.map((connection) => (
            <div className={styles.connectionItem} key={connection.id}>
              <div className={styles.connectionImage}>
                <img
                  src={connection.profileImageUrl}
                  alt={`${connection.displayName}'s profile`}
                  onError={(e) => {
                    e.target.src =
                      "https://placehold.co/100x100/eeeeee/aaaaaa?text=No+Img";
                  }}
                />
              </div>

              <div className={styles.connectionMeta}>
                <h2>{connection.displayName}</h2>
                <p>Email: {connection.email}</p>
                <div className={styles.connectionsBtn}>
                  {/* {[("connectionsOnly"), ("public")].includes(connection.locationSharingPrivacy) && (
                    <Link to={`/mappage`}>
                      <button className={styles.locateMapBtn}>Locate in the map</button>
                    </Link>
                  )} */}
                  {[("public"), ("connectionsOnly")].includes(connection.consumptionSharingPrivacy) && (
                    <>
                      <Link to={`/connections/${connection.id}/inventory`}>
                        <button className={styles.seeInventoryBtn}>See Inventory</button>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.connectionActions}>
                <button
                  className={styles.removeConnectionBtn}
                  onClick={() => handleRemoveConnection(connection.id)}
                  disabled={disconnectingId === connection.id}
                >
                  {disconnectingId === connection.id ? "Removing..." : "Remove"}
                </button>

                {disconnectionFeedback.connectionId === connection.id && (
                  <p style={{ color: disconnectionFeedback.success ? "green" : "red", marginTop: 8 }}>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <br />

      {findConnectionsLoading && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setFindConnectionsLoading(false)}
        >
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Find Connections</h2>
              <button className={styles.modalClose} onClick={() => setFindConnectionsLoading(false)}>Close</button>
            </div>

            <div className={styles.modalContent}>
              {nonConnectionsDetails.length === 0 ? (
                <p>No users available to connect with.</p>
              ) : (
                <div className={styles.connectionList}>
                  {nonConnectionsDetails.map((nonConnection) => (
                    <div className={styles.connectionItem} key={nonConnection.id}>
                      <div className={styles.connectionImage}>
                        <img
                          src={nonConnection.profileImageUrl}
                          alt={`${nonConnection.displayName}'s profile`}
                          onError={(e) => {
                            e.target.src =
                              "https://placehold.co/100x100/eeeeee/aaaaaa?text=No+Img";
                          }}
                        />
                      </div>

                      <div className={styles.connectionMeta}>
                        <h2>{nonConnection.displayName}</h2>
                        <p>Credibility Score: {nonConnection.credibilityScore}</p>
                      </div>

                      <div className={styles.sendConnectionRequest}>
                        {getButtonState(nonConnection)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Connections;