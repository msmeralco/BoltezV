import { useState, useEffect } from "react";
import { getUserByUid, addDummyUserWithInventory, connectTwoUsers, disconnectTwoUsers, sendConnectionRequest, checkUserReportVote, addReportIdToUserUpvoted, addReportIdToUserDownvoted, removeReportVote } from "../firebaseServices/database/usersFunctions";
import { addReport, getReportImageURL } from "../firebaseServices/database/reportsFunctions";
import { addOutage } from "../firebaseServices/database/outagesFunctions";
import { addAnnouncement, getAnnouncementImageURL } from "../firebaseServices/database/announcementsFunctions";
import { GeoPoint } from "firebase/firestore"; // Import GeoPoint

function TestPage() {
  const [queryUser, setQueryUser] = useState(null);
  const [userId, setUserId] = useState("");
  const [dummyName, setDummyName] = useState("");
  const [user1Id, setUser1Id] = useState("");
  const [user2Id, setUser2Id] = useState("");
  const [senderId, setSenderId] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [reportData, setReportData] = useState({
    reporterId: "",
    reporterName: "",
    title: "",
    description: "",
    imageFile: null, // Changed from imageURL to imageFile
    locationLat: "",
    locationLng: "",
    approvalStatus: "",
    responseStatus: "",
  });
  const [outageData, setOutageData] = useState({
    reporterId: "",
    reporterName: "",
    title: "",
    description: "",
    isPlanned: false,
    locationLat: "",
    locationLng: "",
    approvalStatus: "",
    responseStatus: "",
    geopoints: [],
  });
  const [announcementData, setAnnouncementData] = useState({
    userId: "",
    title: "",
    description: "",
    imageFile: null, // Changed from imageURL to imageFile
    locationLat: "",
    locationLng: "",
    startTime: "",
    endTime: "",
    geopoints: [],
  });
  const [voteTestData, setVoteTestData] = useState({
    userId: "",
    reportId: "",
    voteType: "upvoted",
  });
  const [voteCheckResult, setVoteCheckResult] = useState(null);

  async function getUser(event) {
    event.preventDefault(); // Prevent form submission from reloading the page
    try {
      const user = await getUserByUid(userId);
      setQueryUser(user);
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmitAddDummyUser(event) {
    event.preventDefault();
    try {
      const { id, name } = await addDummyUserWithInventory(dummyName); // Added await to resolve the promise
      console.log(`Dummy User Added: ${name} (ID: ${id})`); // Moved log inside try block
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmitConnectTwoUsers(event) {
    event.preventDefault();
    try {
      const result = await connectTwoUsers(user1Id, user2Id);
      if (result.success) {
        console.log(result.message);
      } else {
        console.log("connect two users failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmitDisconnectTwoUsers(event) {
    event.preventDefault();
    try {
      const result = await disconnectTwoUsers(user1Id, user2Id);
      if (result.success) {
        console.log(result.message);
      } else {
        console.log("disconnect two users failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmitSendConnectionRequest(event) {
    event.preventDefault();
    try {
      const result = await sendConnectionRequest(senderId, receiverId);
      if (result.success) {
        console.log(result.message);
      } else {
        console.log("send connection request failed.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function onSubmitAddReport(event) {
    event.preventDefault();
    try {
      const imageURL = reportData.imageFile
        ? await getReportImageURL(reportData.imageFile)
        : null;

      const reportPayload = {
        reporterId: reportData.reporterId,
        reporterName: reportData.reporterName,
        title: reportData.title,
        description: reportData.description,
        imageURL, // Ensure imageURL is passed to Firestore
        location: {
          lat: parseFloat(reportData.locationLat),
          lng: parseFloat(reportData.locationLng),
        },
        approvalStatus: reportData.approvalStatus,
        responseStatus: reportData.responseStatus,
      };

      await addReport(reportPayload);
      alert("Report added successfully!");
    } catch (error) {
      console.error("Error adding report:", error);
      alert("Failed to add report.");
    }
  }

  async function onSubmitAddOutage(event) {
    event.preventDefault();
    try {
      const { reporterId, reporterName, title, description, isPlanned, locationLat, locationLng, approvalStatus, responseStatus, geopoints } = outageData;
      const location =
        locationLat && locationLng
          ? { lat: parseFloat(locationLat), lng: parseFloat(locationLng) }
          : null;

      const parsedGeopoints = geopoints.map(({ lat, lng }) => new GeoPoint(lat, lng));

      const result = await addOutage({
        reporterId,
        reporterName,
        title,
        description,
        isPlanned,
        location,
        approvalStatus,
        responseStatus,
        geopoints: parsedGeopoints,
      });
      console.log(`Outage Added: ID ${result.id}`);
    } catch (err) {
      console.error("Error adding outage:", err);
    }
  }

  async function onSubmitAddAnnouncement(event) {
    event.preventDefault();
    try {
      const imageURL = announcementData.imageFile
        ? await getAnnouncementImageURL(announcementData.imageFile)
        : null;

      const geopoints = announcementData.geopoints.map(({ lat, lng }) => new GeoPoint(lat, lng));

      const announcementPayload = {
        userId: announcementData.userId,
        title: announcementData.title,
        description: announcementData.description,
        imageUrl: imageURL, // Correctly include imageUrl in Firestore payload
        location: {
          lat: parseFloat(announcementData.locationLat),
          lng: parseFloat(announcementData.locationLng),
        },
        startTime: announcementData.startTime,
        endTime: announcementData.endTime,
        geopoints,
      };

      await addAnnouncement(announcementPayload);
      alert("Announcement added successfully!");
    } catch (error) {
      console.error("Error adding announcement:", error);
      alert("Failed to add announcement.");
    }
  }

  async function onSubmitCheckReportVote(event) {
    event.preventDefault();
    try {
      const result = await checkUserReportVote(
        voteTestData.userId,
        voteTestData.reportId,
        voteTestData.voteType
      );
      setVoteCheckResult(result);
      console.log(`Report vote check result: ${result}`);
    } catch (error) {
      console.error("Error checking report vote:", error);
      alert(`Error: ${error.message}`);
    }
  }

  async function onSubmitAddReportUpvote(event) {
    event.preventDefault();
    try {
      const result = await addReportIdToUserUpvoted(
        voteTestData.userId,
        voteTestData.reportId
      );
      console.log(result.message);
      alert(result.message);
    } catch (error) {
      console.error("Error adding upvote:", error);
      alert(`Error: ${error.message}`);
    }
  }

  async function onSubmitAddReportDownvote(event) {
    event.preventDefault();
    try {
      const result = await addReportIdToUserDownvoted(
        voteTestData.userId,
        voteTestData.reportId
      );
      console.log(result.message);
      alert(result.message);
    } catch (error) {
      console.error("Error adding downvote:", error);
      alert(`Error: ${error.message}`);
    }
  }

  async function onSubmitRemoveReportVote(event) {
    event.preventDefault();
    try {
      const result = await removeReportVote(
        voteTestData.userId,
        voteTestData.reportId
      );
      console.log(result.message);
      alert(result.message);
    } catch (error) {
      console.error("Error removing vote:", error);
      alert(`Error: ${error.message}`);
    }
  }

  useEffect(() => {
    if (queryUser) {
      console.log(queryUser); // Log queryUser when it updates
    }

  }, [queryUser]);

  return (
    <div>
      <h1>Testing Page</h1>
        <form onSubmit={getUser}>
        <label>User ID</label>
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <input type="submit" value="Console Log User" />
      </form>

      <form onSubmit={onSubmitAddDummyUser}>
        <label>Dummy Name</label>
        <input
          type="text"
          value={dummyName}
          onChange={(e) => setDummyName(e.target.value)}
          placeholder="Dummy Name"
        />
        <input type="submit" value="Add Dummy User" />
      </form>

      <form onSubmit={onSubmitConnectTwoUsers}>
        <label>User1 ID</label>
        <input
          type="text"
          value={user1Id}
          onChange={(e) => setUser1Id(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <label>User2 ID</label>
        <input
          type="text"
          value={user2Id}
          onChange={(e) => setUser2Id(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <input type="submit" value="Connect Two Users" />
      </form>

      <form onSubmit={onSubmitDisconnectTwoUsers}>
        <label>User1 ID</label>
        <input
          type="text"
          value={user1Id}
          onChange={(e) => setUser1Id(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <label>User2 ID</label>
        <input
          type="text"
          value={user2Id}
          onChange={(e) => setUser2Id(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <input type="submit" value="Disconnect Two Users" />
      </form>

      <form onSubmit={onSubmitSendConnectionRequest}>
        <label>Sender User ID</label>
        <input
          type="text"
          value={senderId}
          onChange={(e) => setSenderId(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <label>Receiver User ID</label>
        <input
          type="text"
          value={receiverId}
          onChange={(e) => setReceiverId(e.target.value)}
          placeholder="UcMpE727iK8qI9chFI8T"
        />
        <input type="submit" value="Send Connection Request" />
      </form>

      <br />
      <hr />
      <br />
      <form onSubmit={onSubmitAddReport}>
        <label>Reporter ID</label>
        <input
          type="text"
          value={reportData.reporterId}
          onChange={(e) => setReportData({ ...reportData, reporterId: e.target.value })}
          placeholder="Reporter ID"
          required
        />
        <label>Reporter Name</label>
        <input
          type="text"
          value={reportData.reporterName}
          onChange={(e) => setReportData({ ...reportData, reporterName: e.target.value })}
          placeholder="Reporter Name"
        />
        <label>Title</label>
        <input
          type="text"
          value={reportData.title}
          onChange={(e) => setReportData({ ...reportData, title: e.target.value })}
          placeholder="Title"
          required
        />
        <label>Description</label>
        <textarea
          value={reportData.description}
          onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
          placeholder="Description"
        ></textarea>
        <label>
          Image File:
          <input
            type="file"
            accept="image/jpeg, image/png"
            onChange={(e) =>
              setReportData({ ...reportData, imageFile: e.target.files[0] })
            }
          />
        </label>
        <label>Location Latitude</label>
        <input
          type="number"
          step="any"
          value={reportData.locationLat}
          onChange={(e) => setReportData({ ...reportData, locationLat: e.target.value })}
          placeholder="Latitude"
        />
        <label>Location Longitude</label>
        <input
          type="number"
          step="any"
          value={reportData.locationLng}
          onChange={(e) => setReportData({ ...reportData, locationLng: e.target.value })}
          placeholder="Longitude"
        />
        <label>Approval Status</label>
        <select
          value={reportData.approvalStatus}
          onChange={(e) => setReportData({ ...reportData, approvalStatus: e.target.value })}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label>Response Status</label>
        <select
          value={reportData.responseStatus}
          onChange={(e) => setReportData({ ...reportData, responseStatus: e.target.value })}
        >
          <option value="not started">Not Started</option>
          <option value="in progress">In Progress</option>
          <option value="fixed">Fixed</option>
        </select>
        <input type="submit" value="Add Report" />
      </form>

      <br />
      <hr />
      <br />
      <form onSubmit={onSubmitAddOutage}>
        <label>Reporter ID</label>
        <input
          type="text"
          value={outageData.reporterId}
          onChange={(e) => setOutageData({ ...outageData, reporterId: e.target.value })}
          placeholder="Reporter ID"
          required
        />
        <label>Reporter Name</label>
        <input
          type="text"
          value={outageData.reporterName}
          onChange={(e) => setOutageData({ ...outageData, reporterName: e.target.value })}
          placeholder="Reporter Name"
        />
        <label>Title</label>
        <input
          type="text"
          value={outageData.title}
          onChange={(e) => setOutageData({ ...outageData, title: e.target.value })}
          placeholder="Title"
          required
        />
        <label>Description</label>
        <textarea
          value={outageData.description}
          onChange={(e) => setOutageData({ ...outageData, description: e.target.value })}
          placeholder="Description"
        ></textarea>
        <label>Is Planned</label>
        <input
          type="checkbox"
          checked={outageData.isPlanned}
          onChange={(e) => setOutageData({ ...outageData, isPlanned: e.target.checked })}
        />
        <label>Location Latitude</label>
        <input
          type="number"
          step="any"
          value={outageData.locationLat}
          onChange={(e) => setOutageData({ ...outageData, locationLat: e.target.value })}
          placeholder="Latitude"
        />
        <label>Location Longitude</label>
        <input
          type="number"
          step="any"
          value={outageData.locationLng}
          onChange={(e) => setOutageData({ ...outageData, locationLng: e.target.value })}
          placeholder="Longitude"
        />
        <label>Geolocation Lat 1</label>
        <input
          type="number"
          step="any"
          value={outageData.geopoints[0]?.lat || ""}
          onChange={(e) => {
            const updatedGeopoints = [...(outageData.geopoints || [])];
            updatedGeopoints[0] = { ...updatedGeopoints[0], lat: parseFloat(e.target.value) };
            setOutageData({ ...outageData, geopoints: updatedGeopoints });
          }}
        />
        <label>Geolocation Lng 1</label>
        <input
          type="number"
          step="any"
          value={outageData.geopoints[0]?.lng || ""}
          onChange={(e) => {
            const updatedGeopoints = [...(outageData.geopoints || [])];
            updatedGeopoints[0] = { ...updatedGeopoints[0], lng: parseFloat(e.target.value) };
            setOutageData({ ...outageData, geopoints: updatedGeopoints });
          }}
        />

        <label>Geolocation Lat 2</label>
        <input
          type="number"
          step="any"
          value={outageData.geopoints[1]?.lat || ""}
          onChange={(e) => {
            const updatedGeopoints = [...(outageData.geopoints || [])];
            updatedGeopoints[1] = { ...updatedGeopoints[1], lat: parseFloat(e.target.value) };
            setOutageData({ ...outageData, geopoints: updatedGeopoints });
          }}
        />
        <label>Geolocation Lng 2</label>
        <input
          type="number"
          step="any"
          value={outageData.geopoints[1]?.lng || ""}
          onChange={(e) => {
            const updatedGeopoints = [...(outageData.geopoints || [])];
            updatedGeopoints[1] = { ...updatedGeopoints[1], lng: parseFloat(e.target.value) };
            setOutageData({ ...outageData, geopoints: updatedGeopoints });
          }}
        />

        <label>Geolocation Lat 3</label>
        <input
          type="number"
          step="any"
          value={outageData.geopoints[2]?.lat || ""}
          onChange={(e) => {
            const updatedGeopoints = [...(outageData.geopoints || [])];
            updatedGeopoints[2] = { ...updatedGeopoints[2], lat: parseFloat(e.target.value) };
            setOutageData({ ...outageData, geopoints: updatedGeopoints });
          }}
        />
        <label>Geolocation Lng 3</label>
        <input
          type="number"
          step="any"
          value={outageData.geopoints[2]?.lng || ""}
          onChange={(e) => {
            const updatedGeopoints = [...(outageData.geopoints || [])];
            updatedGeopoints[2] = { ...updatedGeopoints[2], lng: parseFloat(e.target.value) };
            setOutageData({ ...outageData, geopoints: updatedGeopoints });
          }}
        />
        <label>Approval Status</label>
        <select
          value={outageData.approvalStatus}
          onChange={(e) => setOutageData({ ...outageData, approvalStatus: e.target.value })}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label>Response Status</label>
        <select
          value={outageData.responseStatus}
          onChange={(e) => setOutageData({ ...outageData, responseStatus: e.target.value })}
        >
          <option value="not started">Not Started</option>
          <option value="in progress">In Progress</option>
          <option value="fixed">Fixed</option>
        </select>
        <input type="submit" value="Add Outage" />
      </form>

      <br />
      <hr />
      <br />
      <form onSubmit={onSubmitAddAnnouncement}>
        <label>User ID</label>
        <input
          type="text"
          value={announcementData.userId}
          onChange={(e) => setAnnouncementData({ ...announcementData, userId: e.target.value })}
          placeholder="User ID"
          required
        />
        <label>Title</label>
        <input
          type="text"
          value={announcementData.title}
          onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
          placeholder="Title"
          required
        />
        <label>Description</label>
        <textarea
          value={announcementData.description}
          onChange={(e) => setAnnouncementData({ ...announcementData, description: e.target.value })}
          placeholder="Description"
        ></textarea>
        <label>
          Image File:
          <input
            type="file"
            accept="image/jpeg, image/png"
            onChange={(e) =>
              setAnnouncementData({ ...announcementData, imageFile: e.target.files[0] })
            }
          />
        </label>
        <label>Location Latitude</label>
        <input
          type="number"
          step="any"
          value={announcementData.locationLat}
          onChange={(e) => setAnnouncementData({ ...announcementData, locationLat: e.target.value })}
          placeholder="Latitude"
        />
        <label>Location Longitude</label>
        <input
          type="number"
          step="any"
          value={announcementData.locationLng}
          onChange={(e) => setAnnouncementData({ ...announcementData, locationLng: e.target.value })}
          placeholder="Longitude"
        />
        <label>Start Time</label>
        <input
          type="datetime-local"
          value={announcementData.startTime}
          onChange={(e) => setAnnouncementData({ ...announcementData, startTime: e.target.value })}
        />
        <label>End Time</label>
        <input
          type="datetime-local"
          value={announcementData.endTime}
          onChange={(e) => setAnnouncementData({ ...announcementData, endTime: e.target.value })}
        />
        <label>Geolocation Latitude 1</label>
        <input
          type="number"
          step="any"
          value={announcementData.geopoints[0]?.lat || ""}
          onChange={(e) => {
            const updatedGeopoints = [...announcementData.geopoints];
            updatedGeopoints[0] = {
              ...updatedGeopoints[0],
              lat: parseFloat(e.target.value),
            };
            setAnnouncementData({ ...announcementData, geopoints: updatedGeopoints });
          }}
          placeholder="Latitude 1"
        />
        <label>Geolocation Longitude 1</label>
        <input
          type="number"
          step="any"
          value={announcementData.geopoints[0]?.lng || ""}
          onChange={(e) => {
            const updatedGeopoints = [...announcementData.geopoints];
            updatedGeopoints[0] = {
              ...updatedGeopoints[0],
              lng: parseFloat(e.target.value),
            };
            setAnnouncementData({ ...announcementData, geopoints: updatedGeopoints });
          }}
          placeholder="Longitude 1"
        />
        <label>Geolocation Latitude 2</label>
        <input
          type="number"
          step="any"
          value={announcementData.geopoints[1]?.lat || ""}
          onChange={(e) => {
            const updatedGeopoints = [...announcementData.geopoints];
            updatedGeopoints[1] = {
              ...updatedGeopoints[1],
              lat: parseFloat(e.target.value),
            };
            setAnnouncementData({ ...announcementData, geopoints: updatedGeopoints });
          }}
          placeholder="Latitude 2"
        />
        <label>Geolocation Longitude 2</label>
        <input
          type="number"
          step="any"
          value={announcementData.geopoints[1]?.lng || ""}
          onChange={(e) => {
            const updatedGeopoints = [...announcementData.geopoints];
            updatedGeopoints[1] = {
              ...updatedGeopoints[1],
              lng: parseFloat(e.target.value),
            };
            setAnnouncementData({ ...announcementData, geopoints: updatedGeopoints });
          }}
          placeholder="Longitude 2"
        />
        <label>Geolocation Latitude 3</label>
        <input
          type="number"
          step="any"
          value={announcementData.geopoints[2]?.lat || ""}
          onChange={(e) => {
            const updatedGeopoints = [...announcementData.geopoints];
            updatedGeopoints[2] = {
              ...updatedGeopoints[2],
              lat: parseFloat(e.target.value),
            };
            setAnnouncementData({ ...announcementData, geopoints: updatedGeopoints });
          }}
          placeholder="Latitude 3"
        />
        <label>Geolocation Longitude 3</label>
        <input
          type="number"
          step="any"
          value={announcementData.geopoints[2]?.lng || ""}
          onChange={(e) => {
            const updatedGeopoints = [...announcementData.geopoints];
            updatedGeopoints[2] = {
              ...updatedGeopoints[2],
              lng: parseFloat(e.target.value),
            };
            setAnnouncementData({ ...announcementData, geopoints: updatedGeopoints });
          }}
          placeholder="Longitude 3"
        />
        <input type="submit" value="Add Announcement" />
      </form>

      <br />
      <hr />
      <br />
      <h2>Report Vote Testing</h2>
      
      <form onSubmit={onSubmitCheckReportVote}>
        <h3>Check User Report Vote</h3>
        <label>User ID</label>
        <input
          type="text"
          value={voteTestData.userId}
          onChange={(e) => setVoteTestData({ ...voteTestData, userId: e.target.value })}
          placeholder="User ID"
          required
        />
        <label>Report ID</label>
        <input
          type="text"
          value={voteTestData.reportId}
          onChange={(e) => setVoteTestData({ ...voteTestData, reportId: e.target.value })}
          placeholder="Report ID (from Firestore)"
          required
        />
        <label>Vote Type</label>
        <select
          value={voteTestData.voteType}
          onChange={(e) => setVoteTestData({ ...voteTestData, voteType: e.target.value })}
        >
          <option value="upvoted">Upvoted</option>
          <option value="downvoted">Downvoted</option>
        </select>
        <input type="submit" value="Check Vote" />
        {voteCheckResult !== null && (
          <p style={{ fontWeight: 'bold' }}>
            Result: {voteCheckResult ? "Vote exists ✓" : "Vote does not exist ✗"}
          </p>
        )}
      </form>

      <br />
      <form onSubmit={onSubmitAddReportUpvote}>
        <h3>Add Report Upvote</h3>
        <label>User ID</label>
        <input
          type="text"
          value={voteTestData.userId}
          onChange={(e) => setVoteTestData({ ...voteTestData, userId: e.target.value })}
          placeholder="User ID"
          required
        />
        <label>Report ID</label>
        <input
          type="text"
          value={voteTestData.reportId}
          onChange={(e) => setVoteTestData({ ...voteTestData, reportId: e.target.value })}
          placeholder="Report ID (from Firestore)"
          required
        />
        <input type="submit" value="Add Upvote" />
      </form>

      <br />
      <form onSubmit={onSubmitAddReportDownvote}>
        <h3>Add Report Downvote</h3>
        <label>User ID</label>
        <input
          type="text"
          value={voteTestData.userId}
          onChange={(e) => setVoteTestData({ ...voteTestData, userId: e.target.value })}
          placeholder="User ID"
          required
        />
        <label>Report ID</label>
        <input
          type="text"
          value={voteTestData.reportId}
          onChange={(e) => setVoteTestData({ ...voteTestData, reportId: e.target.value })}
          placeholder="Report ID (from Firestore)"
          required
        />
        <input type="submit" value="Add Downvote" />
      </form>

      <br />
      <form onSubmit={onSubmitRemoveReportVote}>
        <h3>Remove Report Vote</h3>
        <label>User ID</label>
        <input
          type="text"
          value={voteTestData.userId}
          onChange={(e) => setVoteTestData({ ...voteTestData, userId: e.target.value })}
          placeholder="User ID"
          required
        />
        <label>Report ID</label>
        <input
          type="text"
          value={voteTestData.reportId}
          onChange={(e) => setVoteTestData({ ...voteTestData, reportId: e.target.value })}
          placeholder="Report ID (from Firestore)"
          required
        />
        <input type="submit" value="Remove Vote" />
      </form>
    </div>
  );
}

export default TestPage;