import React, { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { Camera, RefreshCw, X, Aperture } from "lucide-react";
// Ensure this path points to the root appliances.json
import appliancesData from "../../../appliances.json"; 
// Ensure this points to the file where you pasted the CSS above
import detectionStyles from "./Detection.module.css"; 

function DetectionModal({ onClose, onDetect }) {
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent;
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      setIsMobile(mobileRegex.test(userAgent));
    };
    checkIsMobile();
  }, []);

  // ... (keep runDetection, getApplianceDetails, and all handler functions exactly as they were in previous code) ...
  const runDetection = async (fileToDetect) => {
    if (!fileToDetect) {
      setError("No file provided for detection.");
      return;
    }
    const formData = new FormData();
    formData.append("file", fileToDetect);
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const response = await fetch(
        "https://endpoint-meralco.onrender.com/detect",
        {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data = await response.json();
      if (!data.image) throw new Error("No image returned from API");

      let processedData = { image: data.image, detections: [] };
      if (data.class_names) {
        let classNames = Array.isArray(data.class_names)
          ? data.class_names
          : typeof data.class_names === "string"
          ? data.class_names.split(",").map((c) => c.trim())
          : [];
        processedData.detections = classNames
          .filter((c) => c)
          .map((className) => ({
            class_name: className,
          }));
      }
      setResult(processedData);
    } catch (err) {
      if (err.name === "AbortError") {
        setError(
          "Request timeout: API server may be overloaded. Please try again."
        );
      } else {
        setError(err.message || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const getApplianceDetails = (className) => {
    const appliance = appliancesData.find(
      (item) => item.class_name === className
    );
    return appliance || null;
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setError(null);
      setUseCamera(false);
      runDetection(selectedFile);
    }
  };

  const handleCameraCapture = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setError(null);
      setUseCamera(false);
      runDetection(selectedFile);
    }
  };

  const toggleCameraCapture = () => {
    if (isMobile) {
      cameraInputRef.current?.click();
    } else {
      setUseCamera(!useCamera);
    }
  };

  const capturePhoto = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    fetch(imageSrc)
      .then((res) => res.blob())
      .then((blob) => {
        const newFile = new File([blob], "camera-capture.jpg", {
          type: "image/jpeg",
        });
        setFile(newFile);
        setPreview(imageSrc);
        setResult(null);
        setError(null);
        runDetection(newFile);
      })
      .catch((err) => {
        console.error("Error converting image:", err);
        setError("Error capturing photo");
      });
  };

  const toggleCamera = () => {
    setUseCamera(!useCamera);
    setFile(null);
    setPreview(null);
    setResult(null);
  };

  const switchCamera = () => {
    setFacingMode(facingMode === "user" ? "environment" : "user");
  };

  const handleDetectionSelect = (applianceDetails) => {
    if (applianceDetails) {
      onDetect({
        details: applianceDetails,
        originalFile: file,
      });
      setResult(null);
      setFile(null);
      setPreview(null);
      setError(null);
    }
  };

  return (
    // 1. The Outer Backdrop
    <div className={detectionStyles.dialogBackdrop} onClick={onClose}>
      {/* 2. The Modal Content Box */}
      <div
        className={detectionStyles.dialogContent}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={detectionStyles.dialogClose} onClick={onClose}>
          <X size={24} />
        </button>
        <h2 className={detectionStyles.dialogTitle}>Detect Appliance</h2>

        <div className={detectionStyles.container}>
          {!useCamera ? (
            <div className={detectionStyles.form}>
              <div
                className={detectionStyles.fileInputWrapper}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-input"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={detectionStyles.fileInput}
                />
                <label
                  htmlFor="file-input"
                  className={detectionStyles.fileLabel}
                >
                  {file ? `📁 ${file.name}` : "📂 Choose Image"}
                </label>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                onChange={handleCameraCapture}
                className={detectionStyles.fileInput}
                capture="environment"
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={toggleCameraCapture}
                className={detectionStyles.cameraBtn}
              >
                <Camera size={20} /> Open Camera
              </button>

              {preview && !result && (
                <div className={detectionStyles.previewContainer}>
                  {loading && (
                    <div className={detectionStyles.loadingIndicator}>
                      ⏳ Processing...
                    </div>
                  )}
                  <img
                    src={preview}
                    alt="Preview"
                    className={detectionStyles.previewImage}
                    style={{ opacity: loading ? 0.5 : 1 }}
                  />
                </div>
              )}
              {result && result.image && (
                <div className={detectionStyles.previewContainer}>
                  <img
                    src={result.image}
                    alt="Annotated"
                    className={detectionStyles.previewImage}
                  />
                </div>
              )}
              {result && result.detections && result.detections.length > 0 && (
                <div className={detectionStyles.applianceInfo}>
                  <label>
                    Detected Appliances ({result.detections.length}):
                  </label>
                  <div className={detectionStyles.applianceList}>
                    {result.detections.map((detection, index) => {
                      const applianceDetails = getApplianceDetails(
                        detection.class_name
                      );
                      return (
                        <div
                          key={index}
                          className={detectionStyles.applianceItem}
                        >
                          <p>
                            <strong>
                              {applianceDetails?.appliance_name ||
                                detection.class_name}
                            </strong>{" "}
                            - {applianceDetails?.wattage || "N/A"}W
                          </p>
                          <button
                            type="button"
                            className={detectionStyles.submitBtn}
                            onClick={() =>
                              handleDetectionSelect(applianceDetails)
                            }
                          >
                            Use This
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {result &&
                (!result.detections || result.detections.length === 0) && (
                  <div
                    className={detectionStyles.applianceInfo}
                    style={{
                      color: "#666",
                      padding: "1rem",
                      textAlign: "center",
                    }}
                  >
                    <p>No appliances detected.</p>
                  </div>
                )}
              {result && (
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    setPreview(null);
                    setError(null);
                  }}
                  className={detectionStyles.resetBtn}
                >
                  New Detection
                </button>
              )}
            </div>
          ) : (
            <div className={detectionStyles.cameraContainer}>
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  facingMode: facingMode,
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }}
                className={detectionStyles.webcam}
                mirrored={facingMode === "user"}
                onUserMediaError={() => {
                  setError("Camera access denied.");
                  setUseCamera(false);
                }}
              />
              <div className={detectionStyles.cameraControls}>
                <button
                  onClick={capturePhoto}
                  className={detectionStyles.captureBtn}
                  disabled={loading}
                  title="Capture Photo"
                >
                  <Aperture size={32} color="#333" />
                </button>
                <button
                  onClick={switchCamera}
                  className={detectionStyles.switchBtn}
                  disabled={loading}
                  title="Switch Camera"
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={toggleCamera}
                  className={detectionStyles.closeCameraBtn}
                  disabled={loading}
                  title="Close Camera"
                >
                  <X size={24} />
                </button>
              </div>
              {preview && !result && (
                <div className={detectionStyles.previewContainer}>
                  {loading && (
                    <div className={detectionStyles.loadingIndicator}>
                      ⏳ Processing...
                    </div>
                  )}
                  <img
                    src={preview}
                    alt="Captured"
                    className={detectionStyles.previewImage}
                    style={{ opacity: loading ? 0.5 : 1 }}
                  />
                </div>
              )}
              {result && result.image && (
                <div className={detectionStyles.previewContainer}>
                  <img
                    src={result.image}
                    alt="Annotated"
                    className={detectionStyles.previewImage}
                  />
                </div>
              )}
              {result && result.detections && result.detections.length > 0 && (
                <div className={detectionStyles.applianceInfo}>
                  <label>
                    Detected Appliances ({result.detections.length}):
                  </label>
                  <div className={detectionStyles.applianceList}>
                    {result.detections.map((detection, index) => {
                      const applianceDetails = getApplianceDetails(
                        detection.class_name
                      );
                      return (
                        <div
                          key={index}
                          className={detectionStyles.applianceItem}
                        >
                          <p>
                            <strong>
                              {applianceDetails?.appliance_name ||
                                detection.class_name}
                            </strong>{" "}
                            - {applianceDetails?.wattage || "N/A"}W
                          </p>
                          <button
                            type="button"
                            className={detectionStyles.submitBtn}
                            onClick={() =>
                              handleDetectionSelect(applianceDetails)
                            }
                          >
                            Use This
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {result &&
                (!result.detections || result.detections.length === 0) && (
                  <div
                    className={detectionStyles.applianceInfo}
                    style={{
                      color: "#666",
                      padding: "1rem",
                      textAlign: "center",
                    }}
                  >
                    <p>No appliances detected.</p>
                  </div>
                )}
              {result && (
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    setPreview(null);
                    setError(null);
                  }}
                  className={detectionStyles.resetBtn}
                >
                  New Detection
                </button>
              )}
            </div>
          )}
          {error && (
            <div className={detectionStyles.errorMessage}>⚠️ {error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DetectionModal;