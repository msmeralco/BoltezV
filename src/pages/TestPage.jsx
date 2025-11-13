import { useState, useEffect } from "react";
import { getUserByUid, addDummyUserWithInventory, connectTwoUsers, disconnectTwoUsers, sendConnectionRequest } from "../firebaseServices/database/usersFunctions";
import { addReport } from "../firebaseServices/database/reportsFunctions";
import { addOutage } from "../firebaseServices/database/outagesFunctions";
import { addAnnouncement } from "../firebaseServices/database/announcementsFunctions";

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
    imageURL: "",
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
  });
  const [announcementData, setAnnouncementData] = useState({
    userId: "",
    title: "",
    description: "",
    locationLat: "",
    locationLng: "",
    startTime: "",
    endTime: "",
  });

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
      const { reporterId, reporterName, title, description, imageURL, locationLat, locationLng, approvalStatus, responseStatus } = reportData;
      const location =
        locationLat && locationLng
          ? { lat: parseFloat(locationLat), lng: parseFloat(locationLng) }
          : null;

      const result = await addReport({
        reporterId,
        reporterName,
        title,
        description,
        imageURL,
        location,
        approvalStatus,
        responseStatus,
      });
      console.log(`Report Added: ID ${result.id}`);
    } catch (err) {
      console.error("Error adding report:", err);
    }
  }

  async function onSubmitAddOutage(event) {
    event.preventDefault();
    try {
      const { reporterId, reporterName, title, description, isPlanned, locationLat, locationLng, approvalStatus, responseStatus } = outageData;
      const location =
        locationLat && locationLng
          ? { lat: parseFloat(locationLat), lng: parseFloat(locationLng) }
          : null;

      const result = await addOutage({
        reporterId,
        reporterName,
        title,
        description,
        isPlanned,
        location,
        approvalStatus,
        responseStatus,
      });
      console.log(`Outage Added: ID ${result.id}`);
    } catch (err) {
      console.error("Error adding outage:", err);
    }
  }

  async function onSubmitAddAnnouncement(event) {
    event.preventDefault();
    try {
      const { userId, title, description, locationLat, locationLng, startTime, endTime } = announcementData;
      const location =
        locationLat && locationLng
          ? { lat: parseFloat(locationLat), lng: parseFloat(locationLng) }
          : null;

      const result = await addAnnouncement({
        userId,
        title,
        description,
        location,
        startTime,
        endTime,
      });
      console.log(`Announcement Added: ID ${result.id}`);
    } catch (err) {
      console.error("Error adding announcement:", err);
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
        />
        <label>Description</label>
        <input
          type="text"
          value={reportData.description}
          onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
          placeholder="Description"
        />
        <label>Image URL</label>
        <input
          type="text"
          value={reportData.imageURL}
          onChange={(e) => setReportData({ ...reportData, imageURL: e.target.value })}
          placeholder="Image URL"
        />
        <label>Location Latitude</label>
        <input
          type="text"
          value={reportData.locationLat}
          onChange={(e) => setReportData({ ...reportData, locationLat: e.target.value })}
          placeholder="Latitude"
        />
        <label>Location Longitude</label>
        <input
          type="text"
          value={reportData.locationLng}
          onChange={(e) => setReportData({ ...reportData, locationLng: e.target.value })}
          placeholder="Longitude"
        />
        <label>Approval Status</label>
        <input
          type="text"
          value={reportData.approvalStatus}
          onChange={(e) => setReportData({ ...reportData, approvalStatus: e.target.value })}
          placeholder="Approval Status"
        />
        <label>Response Status</label>
        <input
          type="text"
          value={reportData.responseStatus}
          onChange={(e) => setReportData({ ...reportData, responseStatus: e.target.value })}
          placeholder="Response Status"
        />
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
        />
        <label>Description</label>
        <input
          type="text"
          value={outageData.description}
          onChange={(e) => setOutageData({ ...outageData, description: e.target.value })}
          placeholder="Description"
        />
        <label>Is Planned</label>
        <input
          type="checkbox"
          checked={outageData.isPlanned}
          onChange={(e) => setOutageData({ ...outageData, isPlanned: e.target.checked })}
        />
        <label>Location Latitude</label>
        <input
          type="text"
          value={outageData.locationLat}
          onChange={(e) => setOutageData({ ...outageData, locationLat: e.target.value })}
          placeholder="Latitude"
        />
        <label>Location Longitude</label>
        <input
          type="text"
          value={outageData.locationLng}
          onChange={(e) => setOutageData({ ...outageData, locationLng: e.target.value })}
          placeholder="Longitude"
        />
        <label>Approval Status</label>
        <input
          type="text"
          value={outageData.approvalStatus}
          onChange={(e) => setOutageData({ ...outageData, approvalStatus: e.target.value })}
          placeholder="Approval Status"
        />
        <label>Response Status</label>
        <input
          type="text"
          value={outageData.responseStatus}
          onChange={(e) => setOutageData({ ...outageData, responseStatus: e.target.value })}
          placeholder="Response Status"
        />
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
        />
        <label>Title</label>
        <input
          type="text"
          value={announcementData.title}
          onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
          placeholder="Title"
        />
        <label>Description</label>
        <input
          type="text"
          value={announcementData.description}
          onChange={(e) => setAnnouncementData({ ...announcementData, description: e.target.value })}
          placeholder="Description"
        />
        <label>Location Latitude</label>
        <input
          type="text"
          value={announcementData.locationLat}
          onChange={(e) => setAnnouncementData({ ...announcementData, locationLat: e.target.value })}
          placeholder="Latitude"
        />
        <label>Location Longitude</label>
        <input
          type="text"
          value={announcementData.locationLng}
          onChange={(e) => setAnnouncementData({ ...announcementData, locationLng: e.target.value })}
          placeholder="Longitude"
        />
        <label>Start Time</label>
        <input
          type="text"
          value={announcementData.startTime}
          onChange={(e) => setAnnouncementData({ ...announcementData, startTime: e.target.value })}
          placeholder="Start Time"
        />
        <label>End Time</label>
        <input
          type="text"
          value={announcementData.endTime}
          onChange={(e) => setAnnouncementData({ ...announcementData, endTime: e.target.value })}
          placeholder="End Time"
        />
        <input type="submit" value="Add Announcement" />
      </form>
    </div>
  );
}

export default TestPage;