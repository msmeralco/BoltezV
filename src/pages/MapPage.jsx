"use client";
import { useState, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  Polygon,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoPoint } from "firebase/firestore";
import ReactDOMServer from "react-dom/server";

import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

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
import { listenToUserConnections } from "../firebaseServices/database/usersFunctions";

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
  hazard: createIcon("#13dca3"),
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
    hazard: "Outage/Hazard",
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
        <Zap className="volt-logo" size={32} />
        <h1 className="voltizen-title">Voltizen</h1>
      </div>
      <p className="sidebar-tagline">Uniting Community & Consumption.</p>
      <p className="sidebar-instruction">
        Click a pin to see details or add your own report.
      </p>
    </div>
  );
}

function MarkerDetailsPanel({
  marker,
  onUpvote,
  onDownvote,
  currentVote,
  userRole,
  onApprove,
  onReject,
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
    displayName,
    credibilityScore,
    profileImageUrl,
  } = marker;

  const headerClass =
    {
      report: "header-report",
      hazard: "header-hazard",
      announcement: "header-announcement",
      connection: "header-connection",
    }[type] || "";

  const finalImageUrl = imageURL || imageUrl;

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
          <p className="detail-description">
            {description}
          </p>
          {type === "hazard" && (
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
          {(type === "announcement" || (type === "hazard" && isPlanned)) && (
            <>
              <p>
                <strong>Starts:</strong> {formatTimestamp(startTime)}
              </p>
              <p>
                <strong>Ends:</strong> {formatTimestamp(endTime)}
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

      {isAdmin && isPending && type !== "announcement" && type !== "connection" && (
        <div className="admin-approval-controls">
          <h4>Admin Action</h4>
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
}) {
  const currentVote = selectedMarker
    ? votedItems[selectedMarker.id]
    : null;

  return (
    <aside className="info-sidebar">
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
}) {
  const [formData, setFormData] = useState(initialFormData);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialFormData);
    }
  }, [isOpen]);

  if (!isOpen || !markerInfo) return null;

  const { type } = markerInfo;
  const isPlannedHazard =
    type === "hazard" &&
    currentUserRole === "admin" &&
    formData.isPlanned;

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData((prev) => ({
        ...prev,
        imageFile: e.target.files[0],
      }));
    }
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
              onChange={handleFormChange}
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
              onChange={handleFormChange}
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

          {type === "hazard" && currentUserRole === "admin" && (
            <div className="form-group-checkbox">
              <input
                type="checkbox"
                id="isPlanned"
                name="isPlanned"
                checked={formData.isPlanned}
                onChange={handleFormChange}
                disabled={isUploading}
              />
              <label htmlFor="isPlanned">Is this a planned outage?</label>
            </div>
          )}

          {(type === "announcement" || isPlannedHazard) && (
            <>
              <div className="form-group">
                <label htmlFor="startTime">Start Time (Optional)</label>
                <input
                  type="datetime-local"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleFormChange}
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
                  onChange={handleFormChange}
                  disabled={isUploading}
                />
              </div>
            </>
          )}

          {(type === "announcement" || isPlannedHazard) && (
            <div className="form-group">
              <label>Affected Area</label>
              <button
                type="button"
                className="button-secondary"
                onClick={onDrawArea}
                disabled={isUploading}
              >
                <Edit size={16} />
                {polygonPoints.length > 0 ? `Redraw Area (${polygonPoints.length} points)` : "Draw Area"}
              </button>
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
          className="map-button-circle mode-button hazard"
          title="Add Outage/Hazard"
          aria-label="Add outage/hazard pin"
          onClick={() => handleSetMode("hazard")}
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

function MapControls({
  markerMode,
  onSetMode,
  onZoomIn,
  onZoomOut,
  onSetLayer,
  userRole,
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
      <PinMenu onSetMode={onSetMode} userRole={userRole} />
      <LayerMenu onSetLayer={onSetLayer} />
    </div>
  );
}

function DrawingControls({ onFinish, onCancel }) {
  return (
    <div className="drawing-controls">
      <div className="drawing-notice">
        <Edit size={16} />
        <strong>Drawing Mode:</strong> Click to add points
      </div>
      <div className="drawing-buttons">
        <button className="button-primary" onClick={onFinish}>
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
  hazard: { color: "var(--secondary-base)", fillColor: "var(--secondary-base)" },
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
  const [markerMode, setMarkerMode] = useState("none");
  const [currentLayer, setCurrentLayer] = useState(mapLayers.light);
  const [toast, setToast] = useState({ isVisible: false, message: "" });
  const [map, setMap] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMarkerInfo, setNewMarkerInfo] = useState(null);
  const [votedItems, setVotedItems] = useState({});

  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);

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

  const allMarkers = useMemo(() => {
    const visibleReports = reports.filter(
      (r) => isAdmin || r.approvalStatus === "approved"
    );
    const visibleOutages = outages.filter(
      (o) => isAdmin || o.approvalStatus === "approved"
    );
    const visibleConnections = connections.filter(
      (c) =>
        c.locationSharingPrivacy === "public" ||
        c.locationSharingPrivacy === "connectionsOnly"
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

    const hazardMarkers = visibleOutages
      .filter((o) => o.location?.latitude && o.location?.longitude)
      .map((o) => ({
        ...o,
        id: o.id,
        pos: { lat: o.location.latitude, lng: o.location.longitude },
        poly: o.geopoints?.map((p) => [p.latitude, p.longitude]) || [],
        type: "hazard",
      }));

    const announcementMarkers = announcements
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
      hazard: hazardMarkers,
      announcement: announcementMarkers,
      connection: connectionMarkers,
    };
  }, [reports, outages, announcements, connections, isAdmin]);

  const showToast = (message) => {
    setToast({ isVisible: true, message });
    setTimeout(() => setToast({ isVisible: false, message: "" }), 2000);
  };

  const zoomIn = () => map && map.zoomIn();
  const zoomOut = () => map && map.zoomOut();

  const handleSetMarkerMode = (mode) => {
    setMarkerMode(mode);
    setSelectedMarker(null);
  };

  const handleMapClick = (latlng, isDrawingClick) => {
    if (isDrawingClick) {
      setPolygonPoints((prev) => [...prev, latlng]);
    } else {
      setNewMarkerInfo({ pos: latlng, type: markerMode });
      setPolygonPoints([]);
      setIsModalOpen(true);
      setMarkerMode("none");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewMarkerInfo(null);
    setPolygonPoints([]);
    setIsDrawing(false);
  };

  const handleStartDrawArea = () => {
    setIsModalOpen(false);
    setIsDrawing(true);
    setPolygonPoints([]);
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
      } else if (type === "hazard") {
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
      showToast("Pin added successfully!");
    } catch (error) {
      console.error("Failed to add marker:", error);
    }
  };

  const handleUpvote = async () => {
    if (!selectedMarker || !user || votedItems[selectedMarker.id]) return;
    const { id, type } = selectedMarker;
    try {
      if (type === "report") {
        await incrementReportUpvoteCount(id);
      } else if (type === "hazard") {
        await incrementOutageUpvoteCount(id);
      }
      setVotedItems((prev) => ({ ...prev, [id]: "up" }));
    } catch (error) {
      console.error("Upvote failed:", error);
    }
  };

  const handleDownvote = async () => {
    if (!selectedMarker || !user || votedItems[selectedMarker.id]) return;
    const { id, type } = selectedMarker;
    try {
      if (type === "report") {
        await incrementReportDownvoteCount(id);
      } else if (type === "hazard") {
        await incrementOutageDownvoteCount(id);
      }
      setVotedItems((prev) => ({ ...prev, [id]: "down" }));
    } catch (error) {
      console.error("Downvote failed:", error);
    }
  };

  const handleApprove = async () => {
    if (!selectedMarker || !isAdmin) return;
    const { id, type } = selectedMarker;
    try {
      if (type === "report") {
        await updateReportApprovalStatus(id, "approved");
      } else if (type === "hazard") {
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
      } else if (type === "hazard") {
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
    setIsLayerMenuOpen(false);
  };

  const handleMarkerClick = (marker) => {
    setSelectedMarker(marker);
    if (map) {
      map.flyTo(marker.pos, 15);
    }
  };
  const getModeLabel = (mode) =>
    ({
      report: "User Report",
      hazard: "Hazard/Outage",
      announcement: "Announcement",
    }[mode] || "None");
  const getMarkerDescription = (type) =>
    ({
      report: "A user has reported a potential issue in this area.",
      hazard: "Warning: A confirmed hazard is at this location.",
      announcement:
        "An official announcement or maintenance notice is active.",
    }[type] || "Details for this pin.");
  const getMarkerHeaderClass = (type) =>
    ({
      report: "header-report",
      hazard: "header-hazard",
      announcement: "header-announcement",
    }[type] || "");

  const allPolygons = [
    ...allMarkers.report,
    ...allMarkers.hazard,
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
      />

      <Sidebar
        selectedMarker={selectedMarker}
        onUpvote={handleUpvote}
        onDownvote={handleDownvote}
        votedItems={votedItems}
        userRole={userRole}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <main className="map-content">
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
            {reportMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => setSelectedMarker(marker),
                }}
              />
            ))}
          </MarkerClusterGroup>

          <MarkerClusterGroup
            className="hazard-cluster-group"
            iconCreateFunction={createCustomClusterIcon("hazard-cluster-group")}
          >
            {hazardMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => setSelectedMarker(marker),
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
            {announcementMarkers.map((marker) => (
              <Marker
                key={marker.id}
                position={marker.pos}
                icon={icons[marker.type]}
                eventHandlers={{
                  click: () => setSelectedMarker(marker),
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
          />
        )}
      </main>
    </div>
  );
}