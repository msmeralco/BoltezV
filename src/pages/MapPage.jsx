"use client";
import { useState, useMemo, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Polygon,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoPoint, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseServices/firebaseConfig";
import ReactDOMServer from "react-dom/server";

import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import voltizenLogo from "../assets/voltizen-logo.png";

import "./MapPage.css";
import {
  Plus,
  Minus,
  Flag,
  TriangleAlert,
  Megaphone,
  Map as MapIcon,
  Satellite,
  Moon,
  Pin,
  Layers,
  Sun,
  Mountain,
  Palette,
  Zap,
  CheckCircle2,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Check,
  XCircle,
  Edit,
  House,
  Award,
  Filter,
  Menu,
} from "lucide-react";

import {
  addAnnouncement,
  getAllAnnouncements,
  getAnnouncementImageURL,
} from "../firebaseServices/database/announcementsFunctions";
import {
  addOutage,
  getAllOutages,
  incrementOutageUpvoteCount,
  incrementOutageDownvoteCount,
  updateOutageApprovalStatus,
} from "../firebaseServices/database/outagesFunctions";
import {
  addReport,
  getAllReports,
  incrementReportUpvoteCount,
  incrementReportDownvoteCount,
  updateReportApprovalStatus,
  getReportImageURL,
} from "../firebaseServices/database/reportsFunctions";
import {
  listenToUserConnections,
  addReportIdToUserUpvoted,
  addReportIdToUserDownvoted,
} from "../firebaseServices/database/usersFunctions";

import useAuth from "../firebaseServices/auth/useAuth";

delete L.Icon.Default.prototype._getIconUrl;

const createLucideIcon = (IconComponent, color) => {
  const iconHtml = ReactDOMServer.renderToString(
    <IconComponent color={color} size={32} strokeWidth={2} />
  );

  return new L.DivIcon({
    html: `<div class="leaflet-lucide-icon-wrapper">${iconHtml}</div>`,
    className: "leaflet-lucide-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

const createIcon = (color) => {
  const markerHtml = `<svg viewBox="0 0 32 32" class="marker-svg" style="fill:${color};"><path d="M16 0C10.486 0 6 4.486 6 10c0 5.515 10 22 10 22s10-16.485 10-22C26 4.486 21.514 0 16 0zm0 15c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5z"/></svg>`;
  return new L.DivIcon({
    html: markerHtml,
    className: "custom-div-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

const icons = {
  report: createIcon("#d81916"),
  outage: createIcon("#13dca3"),
  announcement: createIcon("#faca46"),
  connection: createLucideIcon(House, "#3b82f6"),
};

const mapLayers = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
  toner: {
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>, &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a>, &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
  },
};

const labelsLayerUrl =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const labelsLayerAttribution = "&copy; Esri &mdash; Boundaries & Places";

function MapClickHandler({ onMapClick, markerMode, isDrawing }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onMapClick(e.latlng, true);
      } else if (markerMode !== "none") {
        onMapClick(e.latlng, false);
      }
    },
  });
  return null;
}

const createCustomClusterIcon = (className) => {
  return function (cluster) {
    const count = cluster.getChildCount();
    let size = "marker-cluster-small";
    if (count >= 10) {
      size = "marker-cluster-medium";
    } else if (count >= 100) {
      size = "marker-cluster-large";
    }

    return L.divIcon({
      html: `<div><span>${count}</span></div>`,
      className: `marker-cluster ${size} ${className}`,
      iconSize: [40, 40],
    });
  };
};

const getModeLabel = (mode) =>
  ({
    report: "User Report",
    outage: "Outage",
    announcement: "Announcement",
    connection: "Connection's Location",
  }[mode] || "None");

const initialFormData = {
  title: "",
  description: "",
  imageFile: null,
  isPlanned: false,
  startTime: "",
  endTime: "",
};

function DefaultSidebarPanel() {
  return (
    <div className="sidebar-default-content">
      <div className="logo-header">
        <img
          src={voltizenLogo}
          alt="Voltizen Logo"
          className="voltizen-logo-img"
        />
      </div>
      <p className="sidebar-tagline">Uniting Community & Consumption.</p>
      <p className="sidebar-instruction">
        Click a pin to see details or add your own report.
      </p>
    </div>
  );
}

const formatTimestamp = (ts) => {
  if (!ts) return "N/A";
  let date;
  if (ts.toDate) {
    date = ts.toDate();
  } else if (typeof ts === "string" || typeof ts === "number") {
    date = new Date(ts);
  } else {
    return "Invalid Date";
  }
  return date.toLocaleString();
};

function MarkerDetailsPanel({
  marker,
  onUpvote,
  onDownvote,
  currentVote,
  userRole,
  onApprove,
  onReject,
  onEditStatus,
}) {
  const {
    type,
    title,
    description,
    reporterName,
    responseStatus,
    approvalStatus,
    upvoteCount,
    downvoteCount,
    pos,
    imageUrl,
    imageURL,
    isPlanned,
    startTime,
    endTime,
    timeCreated,
    displayName,
    credibilityScore,
    profileImageUrl,
  } = marker;

  const headerClass =
    {
      report: "header-report",
      outage: "header-outage",
      announcement: "header-announcement",
      connection: "header-connection",
    }[type] || "";

  const finalImageUrl = imageURL || imageUrl;

  const isUpvoted = currentVote === "up";
  const isDownvoted = currentVote === "down";
  const isAdmin = userRole === "admin";
  const isPending = approvalStatus === "pending";

  return (
    <div className="marker-data-display">
      <h1 className={headerClass}>{title || displayName || getModeLabel(type)}</h1>

      {type === "connection" && (
        <div className="connection-details">
          <img
            src={profileImageUrl}
            alt={displayName}
            className="connection-pfp"
          />
          <div className="connection-info">
            <span className="connection-name">{displayName}</span>
            <span className="connection-score">
              <Award size={16} />
              {credibilityScore || 0} Credibility
            </span>
          </div>
        </div>
      )}

      {finalImageUrl && (
        <div className="marker-image-wrapper">
          <img src={finalImageUrl} alt={title || "Marker Image"} />
        </div>
      )}

      {description && (
        <div className="details">
          <h4>Details</h4>
          <p className="detail-description">{description}</p>
          {type === "outage" && (
            <p>
              <strong>Type:</strong>{" "}
              <span
                className={
                  isPlanned ? "planned-outage" : "unplanned-outage"
                }
              >
                {isPlanned ? "Planned" : "Unplanned"}
              </span>
            </p>
          )}

          {timeCreated && (
            <p>
              <strong>
                Reported:
              </strong>{" "}
              {formatTimestamp(timeCreated)}
            </p>
          )}

          {isPlanned && (
            <>
              <p>
                <strong>Starts:</strong> {formatTimestamp(startTime)}
              </p>
              <p>
                <strong>Ends:</strong> {formatTimestamp(endTime)}
              </p>
            </>
          )}

          {!isPlanned && type !== "connection" && type !== "announcement" && (
            <>
              <p>
                <strong>Discovered:</strong> {formatTimestamp(startTime)}
              </p>
              <p>
                <strong>Fixed:</strong> {formatTimestamp(endTime)}
              </p>
            </>
          )}
        </div>
      )}

      {type !== "connection" && (
        <div className="status">
          {reporterName && (
            <p>
              <strong>Reporter:</strong> {reporterName}
            </p>
          )}
          {responseStatus && (
            <p>
              <strong>Status:</strong>{" "}
              <span className={`status-${responseStatus.replace(" ", "-")}`}>
                {responseStatus}
              </span>
            </p>
          )}
          {approvalStatus && (
            <p>
              <strong>Approval:</strong>{" "}
              <span className={`status-${approvalStatus}`}>{approvalStatus}</span>
            </p>
          )}
        </div>
      )}

      <div className="location">
        <h4>Location</h4>
        <p>
          <strong>Latitude:</strong> {pos.lat.toFixed(5)}
        </p>
        <p>
          <strong>Longitude:</strong> {pos.lng.toFixed(5)}
        </p>
      </div>

      {isAdmin && type !== "announcement" && type !== "connection" && (
        <div className="admin-approval-controls">
          <h4>Admin Action</h4>
          {isPending ? (
            <div className="admin-buttons">
              <button
                className="button-primary approve-button"
                onClick={onApprove}
              >
                <Check size={18} /> Approve
              </button>
              <button
                className="button-secondary reject-button"
                onClick={onReject}
              >
                <XCircle size={18} /> Reject
              </button>
            </div>
          ) : (
            <button
              className="button-primary edit-status-button"
              onClick={onEditStatus}
            >
              <Edit size={18} /> Edit Status
            </button>
          )}
        </div>
      )}

      {type !== "announcement" && type !== "connection" && (
        <div className="vote-controls-wrapper">
          <div className="vote-controls">
            <button
              onClick={onUpvote}
              aria-label="Upvote"
              className={`vote-button ${isUpvoted ? "active" : ""}`}
              disabled={isUpvoted}
            >
              <ArrowUpCircle size={22} />
              <span>{upvoteCount || 0}</span>
            </button>
            <button
              onClick={onDownvote}
              aria-label="Downvote"
              className={`vote-button ${isDownvoted ? "active" : ""}`}
              disabled={isDownvoted}
            >
              <ArrowDownCircle size={22} />
              <span>{downvoteCount || 0}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({
  selectedMarker,
  onUpvote,
  onDownvote,
  votedItems,
  userRole,
  onApprove,
  onReject,
  onEditStatus,
  isOpen,
}) {
  const currentVote = selectedMarker
    ? votedItems[selectedMarker.id]
    : null;

  return (
    <aside className={`info-sidebar ${isOpen ? "open" : ""}`}>
      <div className="sidebar-content-wrapper">
        <div className="sidebar-section">
          {selectedMarker ? (
            <MarkerDetailsPanel
              marker={selectedMarker}
              onUpvote={onUpvote}
              onDownvote={onDownvote}
              currentVote={currentVote}
              userRole={userRole}
              onApprove={onApprove}
              onReject={onReject}
              onEditStatus={onEditStatus}
            />
          ) : (
            <DefaultSidebarPanel />
          )}
        </div>
      </div>
    </aside>
  );
}

function AddPinModal({
  isOpen,
  onClose,
  onSubmit,
  markerInfo,
  currentUserRole,
  onDrawArea,
  polygonPoints,
  formData,
  onFormChange,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [maxPoints, setMaxPoints] = useState(3);

  if (!isOpen || !markerInfo) return null;

  const { type } = markerInfo;
  const isPlannedOutage =
    type === "outage" &&
    currentUserRole === "admin" &&
    formData.isPlanned;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFormChange({
        ...formData,
        imageFile: e.target.files[0],
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    onFormChange({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleStartDrawing = () => {
    onDrawArea(maxPoints);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    const { pos } = markerInfo;
    const { title, description, isPlanned, startTime, endTime, imageFile } =
      formData;

    const location = { lat: pos.lat, lng: pos.lng };
    let finalImageURL = null;

    try {
      if (imageFile) {
        if (type === "report") {
          finalImageURL = await getReportImageURL(imageFile);
        } else if (type === "announcement") {
          finalImageURL = await getAnnouncementImageURL(imageFile);
        }
      }

      const geoPointsPayload =
        polygonPoints.length > 2
          ? polygonPoints.map((p) => new GeoPoint(p.lat, p.lng))
          : [];

      const payload = {
        title,
        description,
        location,
        imageURL: finalImageURL,
        isPlanned: currentUserRole === "admin" ? isPlanned : false,
        startTime: startTime || null,
        endTime: endTime || null,
        geopoints: geoPointsPayload,
      };

      await onSubmit(type, payload);
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsUploading(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>Add {getModeLabel(type)}</h3>
            <button
              type="button"
              onClick={onClose}
              className="modal-close-button"
              disabled={isUploading}
            >
              <X size={24} />
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              disabled={isUploading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="4"
              required
              disabled={isUploading}
            ></textarea>
          </div>

          {(type === "report" || type === "announcement") && (
            <div className="form-group">
              <label htmlFor="imageFile">Image (Optional)</label>
              <input
                type="file"
                id="imageFile"
                name="imageFile"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
          )}

          {type === "outage" && currentUserRole === "admin" && (
            <div className="form-group-checkbox">
              <input
                type="checkbox"
                id="isPlanned"
                name="isPlanned"
                checked={formData.isPlanned}
                onChange={handleInputChange}
                disabled={isUploading}
              />
              <label htmlFor="isPlanned">Is this a planned outage?</label>
            </div>
          )}

          {(type === "announcement" || isPlannedOutage) && (
            <>
              <div className="form-group">
                <label htmlFor="startTime">Start Time (Optional)</label>
                <input
                  type="datetime-local"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">End Time (Optional)</label>
                <input
                  type="datetime-local"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
              </div>
            </>
          )}

          {(type === "announcement" || isPlannedOutage) && (
            <div className="form-group draw-area-group">
              <label>Affected Area</label>
              <div className="draw-area-controls">
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={maxPoints}
                  onChange={(e) => setMaxPoints(parseInt(e.target.value) || 3)}
                  className="point-input"
                  disabled={isUploading}
                />
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleStartDrawing}
                  disabled={isUploading}
                >
                  <Edit size={16} />
                  {polygonPoints.length > 0 ? `Redraw Area (${polygonPoints.length} pts)` : "Draw Area"}
                </button>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={isUploading}
            >
              {isUploading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditStatusModal({ isOpen, onClose, marker, onStatusUpdate }) {
  const [responseStatus, setResponseStatus] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (marker) {
      setResponseStatus(marker.responseStatus || "not started");

      const formatForInput = (ts) => {
        if (!ts) return "";
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      };

      setStartTime(formatForInput(marker.startTime));
      setEndTime(formatForInput(marker.endTime));
    }
  }, [marker]);

  if (!isOpen || !marker) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const dates = {
      startTime: startTime ? new Date(startTime) : serverTimestamp(),
      endTime: endTime ? new Date(endTime) : null,
    };

    if (responseStatus === "fixed" && !dates.endTime) {
      dates.endTime = serverTimestamp();
    }
    
    if (responseStatus === "in progress" && !dates.startTime && !marker.startTime) {
      dates.startTime = serverTimestamp();
    }
    
    if (responseStatus === 'not started') {
        dates.startTime = null;
        dates.endTime = null;
    }

    try {
      await onStatusUpdate(marker, responseStatus, dates);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  const isUnplanned = !marker.isPlanned && marker.type === "outage";
  const isReport = marker.type === "report";

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3>Update Status</h3>
            <button
              type="button"
              onClick={onClose}
              className="modal-close-button"
              disabled={isLoading}
            >
              <X size={24} />
            </button>
          </div>

          <p className="modal-subtitle">
            Editing status for: <strong>{marker.title}</strong>
          </p>

          <div className="form-group">
            <label htmlFor="responseStatus">Response Status</label>
            <select
              id="responseStatus"
              name="responseStatus"
              value={responseStatus}
              onChange={(e) => setResponseStatus(e.target.value)}
              disabled={isLoading}
            >
              <option value="not started">Not Started</option>
              <option value="in progress">In Progress</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>

          {(isUnplanned || isReport) && (
            <div className="form-group">
              <label htmlFor="startTime">
                {isUnplanned ? "Discovered Date" : "Start Date"}
              </label>
              <input
                type="datetime-local"
                id="startTime"
                name="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isLoading || responseStatus === 'not started'}
              />
            </div>
          )}

          {(isUnplanned || isReport) && (
            <div className="form-group">
              <label htmlFor="endTime">
                {isUnplanned ? "Fixed Date" : "End Date"}
              </label>
              <input
                type="datetime-local"
                id="endTime"
                name="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isLoading || responseStatus !== 'fixed'}
              />
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ZoomControls({ onZoomIn, onZoomOut }) {
  return (
    <div className="control-group zoom-controls">
      <button
        onClick={onZoomIn}
        className="map-button-circle"
        title="Zoom In"
        aria-label="Zoom in"
      >
        <Plus size={24} />
      </button>
      <button
        onClick={onZoomOut}
        className="map-button-circle"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <Minus size={24} />
      </button>
    </div>
  );
}

function PinMenu({ onSetMode, userRole }) {
  const [isPinMenuOpen, setIsPinMenuOpen] = useState(false);

  const handleSetMode = (mode) => {
    onSetMode(mode);
    setIsPinMenuOpen(false);
  };

  return (
    <div
      className={`control-group expandable-menu ${
        isPinMenuOpen ? "menu-open" : ""
      }`}
    >
      <div className="sub-buttons">
        <button
          className="map-button-circle mode-button report"
          title="Add User Report"
          aria-label="Add report pin"
          onClick={() => handleSetMode("report")}
        >
          <Flag size={20} />
        </button>
        <button
          className="map-button-circle mode-button outage"
          title="Add Outage"
          aria-label="Add outage pin"
          onClick={() => handleSetMode("outage")}
        >
          <TriangleAlert size={20} />
        </button>
        {userRole === "admin" && (
          <button
            className="map-button-circle mode-button announcement"
            title="Add Announcement"
            aria-label="Add announcement pin"
            onClick={() => handleSetMode("announcement")}
          >
            <Megaphone size={20} />
          </button>
        )}
      </div>
      <button
        className="map-button-circle menu-toggle-button toggle-pins"
        title="Add Pin"
        aria-label="Toggle pin menu"
        onClick={() => setIsPinMenuOpen(!isPinMenuOpen)}
      >
        <Pin size={20} />
      </button>
    </div>
  );
}

function LayerMenu({ onSetLayer }) {
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);

  const handleSetLayer = (layer) => {
    onSetLayer(layer);
    setIsLayerMenuOpen(false);
  };

  return (
    <div
      className={`control-group expandable-menu ${
        isLayerMenuOpen ? "menu-open" : ""
      }`}
    >
      <div className="sub-buttons">
        <button
          className="map-button-circle layer-button"
          title="Light Map"
          aria-label="Light map"
          onClick={() => handleSetLayer(mapLayers.light)}
        >
          <Sun size={20} />
        </button>
        <button
          className="map-button-circle layer-button"
          title="Street Map"
          aria-label="Street map"
          onClick={() => handleSetLayer(mapLayers.street)}
        >
          <MapIcon size={20} />
        </button>
        <button
          className="map-button-circle layer-button"
          title="B&W Map"
          aria-label="B&W map"
          onClick={() => handleSetLayer(mapLayers.toner)}
        >
          <Palette size={20} />
        </button>
        <button
          className="map-button-circle layer-button"
          title="Terrain Map"
          aria-label="Terrain map"
          onClick={() => handleSetLayer(mapLayers.terrain)}
        >
          <Mountain size={20} />
        </button>
        <button
          className="map-button-circle layer-button"
          title="Satellite Map"
          aria-label="Satellite map"
          onClick={() => handleSetLayer(mapLayers.satellite)}
        >
          <Satellite size={20} />
        </button>
        <button
          className="map-button-circle layer-button"
          title="Dark Map"
          aria-label="Dark map"
          onClick={() => handleSetLayer(mapLayers.dark)}
        >
          <Moon size={20} />
        </button>
      </div>
      <button
        className="map-button-circle menu-toggle-button toggle-layers"
        title="Change Layer"
        aria-label="Toggle layer menu"
        onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
      >
        <Layers size={20} />
      </button>
    </div>
  );
}

function FilterMenu({ filters, onFilterChange }) {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  const handleToggle = (filterName) => {
    onFilterChange((prev) => ({
      ...prev,
      [filterName]: !prev[filterName],
    }));
  };

  return (
    <div
      className={`control-group expandable-menu ${
        isFilterMenuOpen ? "menu-open" : ""
      }`}
    >
      <div className="sub-buttons filter-buttons">
        <button
          className={`map-button-circle filter-button filter-report ${
            filters.report ? "active" : ""
          }`}
          title="Toggle Reports"
          aria-label="Toggle reports"
          onClick={() => handleToggle("report")}
        >
          <Flag size={20} />
        </button>
        <button
          className={`map-button-circle filter-button filter-outage ${
            filters.outage ? "active" : ""
          }`}
          title="Toggle Outages"
          aria-label="Toggle outages"
          onClick={() => handleToggle("outage")}
        >
          <TriangleAlert size={20} />
        </button>
        <button
          className={`map-button-circle filter-button filter-announcement ${
            filters.announcement ? "active" : ""
          }`}
          title="Toggle Announcements"
          aria-label="Toggle announcements"
          onClick={() => handleToggle("announcement")}
        >
          <Megaphone size={20} />
        </button>
        <button
          className={`map-button-circle filter-button filter-connection ${
            filters.connection ? "active" : ""
          }`}
          title="Toggle Connections"
          aria-label="Toggle connections"
          onClick={() => handleToggle("connection")}
        >
          <House size={20} />
        </button>
      </div>
      <button
        className="map-button-circle menu-toggle-button toggle-filters"
        title="Filter Markers"
        aria-label="Toggle filter menu"
        onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
      >
        <Filter size={20} />
      </button>
    </div>
  );
}

function MapControls({
  markerMode,
  onSetMode,
  onZoomIn,
  onZoomOut,
  onSetLayer,
  userRole,
  filters,
  onFilterChange,
}) {
  return (
    <div className="controls-bottom-right">
      {markerMode !== "none" && (
        <div className="current-mode-notice">
          Adding: <strong>{getModeLabel(markerMode)}</strong>
          <button onClick={() => onSetMode("none")} aria-label="Cancel adding pin">
            (Cancel)
          </button>
        </div>
      )}

      <ZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} />
      <FilterMenu filters={filters} onFilterChange={onFilterChange} />
      <PinMenu onSetMode={onSetMode} userRole={userRole} />
      <LayerMenu onSetLayer={onSetLayer} />
    </div>
  );
}

function DrawingControls({ onFinish, onCancel, pointCount, maxPoints }) {
  return (
    <div className="drawing-controls">
      <div className="drawing-notice">
        <Edit size={16} />
        <strong>Drawing Mode:</strong> Click to add points
        ({pointCount}/{maxPoints})
      </div>
      <div className="drawing-buttons">
        <button
          className="button-primary"
          onClick={onFinish}
          disabled={pointCount < 3}
        >
          Finish Drawing
        </button>
        <button className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Toast({ isVisible, message }) {
  if (!isVisible) return null;
  return (
    <div className="pin-toast" aria-live="polite">
      <CheckCircle2 size={18} /> {message}
    </div>
  );
}

const polygonOptions = {
  report: { color: "var(--primary-500)", fillColor: "var(--primary-500)" },
  outage: { color: "var(--secondary-base)", fillColor: "var(--secondary-base)" },
  announcement: { color: "var(--tertiary-500)", fillColor: "var(--tertiary-500)" },
};

export default function MapPage() {
  const { user, firestoreUser } = useAuth();
  const userRole = firestoreUser?.userRole || "regular";
  const isAdmin = userRole === "admin";

  const [reports, setReports] = useState([]);
  const [outages, setOutages] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [connections, setConnections] = useState([]);

  const [selectedMarker, setSelectedMarker] = useState(null);
  const [editingMarker, setEditingMarker] = useState(null);
  const [markerMode, setMarkerMode] = useState("none");
  const [currentLayer, setCurrentLayer] = useState(mapLayers.light);
  const [toast, setToast] = useState({ isVisible: false, message: "" });
  const [map, setMap] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMarkerInfo, setNewMarkerInfo] = useState(null);
  const [votedItems, setVotedItems] = useState({});
  const [formData, setFormData] = useState(initialFormData);

  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [maxPolygonPoints, setMaxPolygonPoints] = useState(0);

  const [isSidebarOpen, setIsSidebarOpen] = useState(
    window.innerWidth > 768
  );

  const [filters, setFilters] = useState({
    report: true,
    outage: true,
    announcement: true,
    connection: true,
  });

  const defaultCenter = [14.589615, 121.065289];
  const zoom = 6;

  useEffect(() => {
    const listeners = [];
    const setupListeners = async () => {
      try {
        const unsubReports = await getAllReports(setReports, console.error);
        const unsubOutages = await getAllOutages(setOutages, console.error);
        const unsubAnnouncements = await getAllAnnouncements(
          setAnnouncements,
          console.error
        );
        const unsubConnections = listenToUserConnections(
          user.uid,
          setConnections,
          console.error
        );
        listeners.push(
          unsubReports,
          unsubOutages,
          unsubAnnouncements,
          unsubConnections
        );
      } catch (err) {
        console.error("Failed to set up listeners:", err);
      }
    };

    if (user) {
      setupListeners();
    }
    return () => {
      listeners.forEach((unsub) => unsub());
    };
  }, [user]);

  useEffect(() => {
    if (firestoreUser) {
      const votes = {};
      if (firestoreUser.reportIdsUpvoted) {
        for (const reportId in firestoreUser.reportIdsUpvoted) {
          votes[reportId] = "up";
        }
      }
      if (firestoreUser.reportIdsDownvoted) {
        for (const reportId in firestoreUser.reportIdsDownvoted) {
          votes[reportId] = "down";
        }
      }
      setVotedItems(votes);
    }
  }, [firestoreUser]);

  const allMarkers = useMemo(() => {
    const visibleReports = reports.filter(
      (r) => (isAdmin || r.approvalStatus === "approved") && filters.report
    );
    const visibleOutages = outages.filter(
      (o) => (isAdmin || o.approvalStatus === "approved") && filters.outage
    );
    const visibleConnections = connections.filter(
      (c) =>
        (c.locationSharingPrivacy === "public" ||
          c.locationSharingPrivacy === "connectionsOnly") &&
        filters.connection
    );
    const visibleAnnouncements = announcements.filter(
      () => filters.announcement
    );

    const reportMarkers = visibleReports
      .filter((r) => r.location?.latitude && r.location?.longitude)
      .map((r) => ({
        ...r,
        id: r.id,
        pos: { lat: r.location.latitude, lng: r.location.longitude },
        poly: r.geopoints?.map((p) => [p.latitude, p.longitude]) || [],
        type: "report",
      }));

    const outageMarkers = visibleOutages
      .filter((o) => o.location?.latitude && o.location?.longitude)
      .map((o) => ({
        ...o,
        id: o.id,
        pos: { lat: o.location.latitude, lng: o.location.longitude },
        poly: o.geopoints?.map((p) => [p.latitude, p.longitude]) || [],
        type: "outage",
      }));

    const announcementMarkers = visibleAnnouncements
      .filter((a) => a.location?.latitude && a.location?.longitude)
      .map((a) => ({
        ...a,
        id: a.id,
        pos: { lat: a.location.latitude, lng: a.location.longitude },
        poly: a.geopoints?.map((p) => [p.latitude, p.longitude]) || [],
        type: "announcement",
      }));

    const connectionMarkers = visibleConnections
      .filter((c) => c.location?.latitude && c.location?.longitude)
      .map((c) => ({
        ...c,
        id: c.id,
        pos: { lat: c.location.latitude, lng: c.location.longitude },
        poly: [],
        type: "connection",
      }));

    return {
      report: reportMarkers,
      outage: outageMarkers,
      announcement: announcementMarkers,
      connection: connectionMarkers,
    };
  }, [reports, outages, announcements, connections, isAdmin, filters]);

  const showToast = (message) => {
    setToast({ isVisible: true, message });
    setTimeout(() => setToast({ isVisible: false, message: "" }), 4000);
  };

  const zoomIn = () => map && map.zoomIn();
  const zoomOut = () => map && map.zoomOut();

  const handleSetMarkerMode = (mode) => {
    setMarkerMode(mode);
    setSelectedMarker(null);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleMapClick = (latlng, isDrawingClick) => {
    if (isDrawingClick) {
      if (polygonPoints.length < maxPolygonPoints - 1) {
        setPolygonPoints((prev) => [...prev, latlng]);
      } else {
        setPolygonPoints((prev) => [...prev, latlng]);
        setIsDrawing(false);
        setIsModalOpen(true);
        setMaxPolygonPoints(0);
      }
    } else {
      setNewMarkerInfo({ pos: latlng, type: markerMode });
      setPolygonPoints([]);
      setFormData(initialFormData);
      setIsModalOpen(true);
      setMarkerMode("none");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewMarkerInfo(null);
    setPolygonPoints([]);
    setIsDrawing(false);
    setFormData(initialFormData);
  };

  const handleStartDrawArea = (maxPoints) => {
    setIsModalOpen(false);
    setIsDrawing(true);
    setPolygonPoints([]);
    setMaxPolygonPoints(maxPoints);
  };

  const handleFinishDrawArea = () => {
    setIsDrawing(false);
    setIsModalOpen(true);
  };

  const handleCancelDrawArea = () => {
    setIsDrawing(false);
    setPolygonPoints([]);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (type, payload) => {
    if (!user) return;

    try {
      if (type === "report") {
        await addReport({
          ...payload,
          reporterId: user.uid,
          reporterName: firestoreUser?.displayName || user.displayName,
        });
      } else if (type === "outage") {
        await addOutage({
          ...payload,
          reporterId: user.uid,
          reporterName: firestoreUser?.displayName || user.displayName,
        });
      } else if (type === "announcement" && isAdmin) {
        await addAnnouncement({
          ...payload,
          userId: user.uid,
        });
      }
      showToast("Pin added! Waiting for admin approval.");
    } catch (error) {
      console.error("Failed to add marker:", error);
    }
  };

  const handleUpvote = async () => {
    if (!selectedMarker || !user || votedItems[selectedMarker.id] === "up")
      return;
    const { id, type } = selectedMarker;
    const originalMarker = { ...selectedMarker };
    const originalVotedItems = { ...votedItems };

    const isSwitching = votedItems[id] === "down";

    setVotedItems((prev) => ({ ...prev, [id]: "up" }));
    setSelectedMarker((prev) => ({
      ...prev,
      upvoteCount: (prev.upvoteCount || 0) + 1,
      downvoteCount: isSwitching
        ? Math.max(0, (prev.downvoteCount || 0) - 1)
        : prev.downvoteCount || 0,
    }));

    try {
      await addReportIdToUserUpvoted(user.uid, id);
      if (type === "report") {
        await incrementReportUpvoteCount(id);
      } else if (type === "outage") {
        await incrementOutageUpvoteCount(id);
      }
    } catch (error) {
      setVotedItems(originalVotedItems);
      setSelectedMarker(originalMarker);
      console.error("Upvote failed:", error);
    }
  };

  const handleDownvote = async () => {
    if (!selectedMarker || !user || votedItems[selectedMarker.id] === "down")
      return;
    const { id, type } = selectedMarker;
    const originalMarker = { ...selectedMarker };
    const originalVotedItems = { ...votedItems };

    const isSwitching = votedItems[id] === "up";

    setVotedItems((prev) => ({ ...prev, [id]: "down" }));
    setSelectedMarker((prev) => ({
      ...prev,
      downvoteCount: (prev.downvoteCount || 0) + 1,
      upvoteCount: isSwitching
        ? Math.max(0, (prev.upvoteCount || 0) - 1)
        : prev.upvoteCount || 0,
    }));

    try {
      await addReportIdToUserDownvoted(user.uid, id);
      if (type === "report") {
        await incrementReportDownvoteCount(id);
      } else if (type === "outage") {
        await incrementOutageDownvoteCount(id);
      }
    } catch (error) {
      setVotedItems(originalVotedItems);
      setSelectedMarker(originalMarker);
      console.error("Downvote failed:", error);
    }
  };

  const handleApprove = async () => {
    if (!selectedMarker || !isAdmin) return;
    const { id, type } = selectedMarker;
    try {
      if (type === "report") {
        await updateReportApprovalStatus(id, "approved");
      } else if (type === "outage") {
        await updateOutageApprovalStatus(id, "approved");
      }
      setSelectedMarker((prev) => ({ ...prev, approvalStatus: "approved" }));
      showToast("Marker approved!");
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  const handleReject = async () => {
    if (!selectedMarker || !isAdmin) return;
    const { id, type } = selectedMarker;
    try {
      if (type === "report") {
        await updateReportApprovalStatus(id, "rejected");
      } else if (type === "outage") {
        await updateOutageApprovalStatus(id, "rejected");
      }
      setSelectedMarker((prev) => ({ ...prev, approvalStatus: "rejected" }));
      showToast("Marker rejected.");
    } catch (error) {
      console.error("Rejection failed:", error);
    }
  };

  const handleSetLayer = (layer) => {
    setCurrentLayer(layer);
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(true);
    }
    if (map) {
      map.flyTo(marker.pos, 15);
    }
  };

  const handleEditStatus = () => {
    setEditingMarker(selectedMarker);
  };

  const handleCloseEditModal = () => {
    setEditingMarker(null);
  };

  const handleUpdateMarkerStatus = async (marker, newStatus, dates) => {
    const { id, type } = marker;
    const payload = { ...dates, responseStatus: newStatus };

    try {
      let docRef;
      if (type === "report") {
        docRef = doc(db, "reports", id);
      } else if (type === "outage") {
        docRef = doc(db, "outages", id);
      }

      if (docRef) {
        await updateDoc(docRef, payload);
      }

      setSelectedMarker((prev) => ({
        ...prev,
        responseStatus: newStatus,
        startTime: dates.startTime || prev.startTime,
        endTime: dates.endTime || prev.endTime,
      }));
      showToast("Status updated successfully!");
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const allPolygons = [
    ...allMarkers.report,
    ...allMarkers.outage,
    ...allMarkers.announcement,
  ].filter((m) => m.poly && m.poly.length > 2);

  return (
    <div className="map-page-container">
      <AddPinModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
        markerInfo={newMarkerInfo}
        currentUserRole={userRole}
        onDrawArea={handleStartDrawArea}
        polygonPoints={polygonPoints}
        formData={formData}
        onFormChange={setFormData}
      />

      <EditStatusModal
        isOpen={!!editingMarker}
        onClose={handleCloseEditModal}
        marker={editingMarker}
        onStatusUpdate={handleUpdateMarkerStatus}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        selectedMarker={selectedMarker}
        onUpvote={handleUpvote}
        onDownvote={handleDownvote}
        votedItems={votedItems}
        userRole={userRole}
        onApprove={handleApprove}
        onReject={handleReject}
        onEditStatus={handleEditStatus}
      />

      <main className="map-content">
        <button
          className="sidebar-toggle-button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <MapContainer
          center={defaultCenter}
          zoom={zoom}
          minZoom={5}
          maxZoom={18}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          ref={setMap}
          className={
            markerMode !== "none" || isDrawing ? "crosshair-cursor" : ""
          }
        >
          <TileLayer
            key={currentLayer.url}
            attribution={currentLayer.attribution}
            url={currentLayer.url}
          />
          {currentLayer === mapLayers.satellite && (
            <TileLayer
              attribution={labelsLayerAttribution}
              url={labelsLayerUrl}
              zIndex={10}
            />
          )}

          <MapClickHandler
            onMapClick={handleMapClick}
            markerMode={markerMode}
            isDrawing={isDrawing}
          />

          {allPolygons.map((marker) => (
            <Polygon
              key={marker.id}
              positions={marker.poly}
              pathOptions={{ ...polygonOptions[marker.type], weight: 2 }}
            />
          ))}

          {isDrawing && polygonPoints.length > 0 && (
            <Polygon
              positions={polygonPoints}
              pathOptions={{
                color: "var(--blue-v)",
                fillColor: "var(--blue-v)",
                weight: 2,
              }}
            />
          )}

          <MarkerClusterGroup
            className="report-cluster-group"
            iconCreateFunction={createCustomClusterIcon("report-cluster-group")}
          >
            {allMarkers.report.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => handleMarkerClick(marker),
                }}
              />
            ))}
          </MarkerClusterGroup>

          <MarkerClusterGroup
            className="outage-cluster-group"
            iconCreateFunction={createCustomClusterIcon("outage-cluster-group")}
          >
            {allMarkers.outage.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => handleMarkerClick(marker),
                }}
              />
            ))}
          </MarkerClusterGroup>

          <MarkerClusterGroup
            className="announcement-cluster-group"
            iconCreateFunction={createCustomClusterIcon(
              "announcement-cluster-group"
            )}
          >
            {allMarkers.announcement.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => handleMarkerClick(marker),
                }}
              />
            ))}
          </MarkerClusterGroup>

          <MarkerClusterGroup
            className="connection-cluster-group"
            iconCreateFunction={createCustomClusterIcon(
              "connection-cluster-group"
            )}
          >
            {allMarkers.connection.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => handleMarkerClick(marker),
                }}
              />
            ))}
          </MarkerClusterGroup>
        </MapContainer>

        <Toast isVisible={toast.isVisible} message={toast.message} />

        {isDrawing && (
          <DrawingControls
            onFinish={handleFinishDrawArea}
            onCancel={handleCancelDrawArea}
            pointCount={polygonPoints.length}
            maxPoints={maxPolygonPoints}
          />
        )}

        {!isDrawing && (
          <MapControls
            markerMode={markerMode}
            onSetMode={handleSetMarkerMode}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onSetLayer={handleSetLayer}
            userRole={userRole}
            filters={filters}
            onFilterChange={setFilters}
          />
        )}
      </main>
    </div>
  );
}