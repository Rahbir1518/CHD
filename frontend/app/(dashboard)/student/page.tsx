"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ConnectionStatus from "@/components/ConnectionStatus";

interface LipBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function StudentPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [serverUrl, setServerUrl] = useState("ws://192.168.1.X:8000/ws/video");
  const [processedFrameSrc, setProcessedFrameSrc] = useState<string | null>(null);
  const [mouthState, setMouthState] = useState("unknown");
  const [lipBbox, setLipBbox] = useState<LipBoundingBox | null>(null);
  const [showProcessed, setShowProcessed] = useState(true);

  // Initialize with window location if possible
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      setServerUrl(`ws://${host}:8000/ws/video`);
    }
  }, []);

  // Start Camera
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Camera API not available. Requires HTTPS or localhost."
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      alert(err.message || "Could not access camera.");
    }
  };

  // Connect WebSocket
  const connectSocket = useCallback(() => {
    if (socket) socket.close();
    setStatus("connecting");

    let url = serverUrl.replace(/^http/, "ws");
    if (!url.startsWith("ws")) url = `ws://${url}`;

    const ws = new WebSocket(url);

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Haptic feedback
        if (
          data.type === "haptic_feedback" &&
          Array.isArray(data.pattern) &&
          data.pattern.length > 0
        ) {
          if (navigator.vibrate) navigator.vibrate(data.pattern);
        }

        // Processed frame with bounding boxes from server
        if (data.type === "processed_frame" && data.frame_base64) {
          const src = data.frame_base64.startsWith("data:")
            ? data.frame_base64
            : `data:image/jpeg;base64,${data.frame_base64}`;
          setProcessedFrameSrc(src);

          if (data.mouth_state) setMouthState(data.mouth_state);
          if (data.lip_bounding_box) setLipBbox(data.lip_bounding_box);
          else setLipBbox(null);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    setSocket(ws);
  }, [serverUrl, socket]);

  // Send frames loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isStreaming && socket && socket.readyState === WebSocket.OPEN) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      intervalId = setInterval(() => {
        if (!videoRef.current || !ctx) return;
        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const scale = 320 / video.videoWidth;
          canvas.width = 320;
          canvas.height = video.videoHeight * scale;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.4);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(base64);
          }
        }
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isStreaming, socket]);

  const mouthStateConfig: Record<string, { icon: string; color: string }> = {
    closed: { icon: "😶", color: "text-gray-400" },
    open: { icon: "😮", color: "text-yellow-400" },
    talking: { icon: "🗣️", color: "text-green-400" },
    unknown: { icon: "❓", color: "text-gray-500" },
  };
  const stateInfo = mouthStateConfig[mouthState] || mouthStateConfig.unknown;

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold">Student Cam</h1>
        <div className="flex items-center gap-3">
          {/* Mouth state badge */}
          {mouthState !== "unknown" && (
            <div
              className={`flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-full text-xs ${stateInfo.color}`}
            >
              <span>{stateInfo.icon}</span>
              <span className="capitalize">{mouthState}</span>
            </div>
          )}
          <ConnectionStatus status={status} />
        </div>
      </div>

      {/* Connection Controls */}
      <div className="mb-4 space-y-2 bg-gray-900 p-3 rounded-lg border border-gray-800">
        <label className="text-xs text-gray-400 uppercase font-semibold">
          Server Address
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm font-mono border border-gray-700 focus:border-blue-500 outline-none"
            placeholder="ws://192.168.x.x:8000/ws/video"
          />
          <button
            onClick={connectSocket}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            Connect
          </button>
        </div>
      </div>

      {/* View toggle */}
      {processedFrameSrc && (
        <div className="mb-2 flex justify-center">
          <button
            onClick={() => setShowProcessed(!showProcessed)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showProcessed
                ? "bg-green-900/40 border-green-600 text-green-400"
                : "bg-gray-800 border-gray-600 text-gray-400"
            }`}
          >
            {showProcessed ? "🎯 Bounding Boxes ON" : "○ Bounding Boxes OFF"}
          </button>
        </div>
      )}

      {/* Camera + Processed Feed */}
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        {/* Raw camera (always running underneath) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            showProcessed && processedFrameSrc ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Processed frame with bounding boxes from server */}
        {showProcessed && processedFrameSrc && (
          <img
            src={processedFrameSrc}
            alt="Processed"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Hidden canvas for frame sending */}
        <canvas ref={processedCanvasRef} className="hidden" />

        {/* Camera start overlay */}
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <button
              onClick={startCamera}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg transform transition active:scale-95 flex items-center gap-2"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Start Camera
            </button>
          </div>
        )}

        {/* Status overlays */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          {showProcessed && processedFrameSrc && lipBbox && (
            <div className="bg-green-600/70 px-2 py-1 rounded text-xs text-white backdrop-blur-sm animate-pulse">
              🎯 Lip Tracking
            </div>
          )}
          {isStreaming && (
            <div className="bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
              Live
            </div>
          )}
        </div>

        {isStreaming && !processedFrameSrc && status === "connected" && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1 rounded-full border border-white/20 animate-pulse">
              Processing frames...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-gray-500 text-xs">
        Ensure phone and dashboard are on the same Wi-Fi · Face the front camera
      </div>
    </div>
  );
}
