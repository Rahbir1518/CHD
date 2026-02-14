"use client";

import { useEffect, useRef, useState } from "react";
import ConnectionStatus from "@/components/ConnectionStatus";

export default function StudentPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [serverUrl, setServerUrl] = useState("ws://192.168.1.X:8000/ws/video"); // Default placeholder

  // Initialize with window location if possible
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      // Default to assuming the server is on port 8000 of the same host
      setServerUrl(`ws://${host}:8000/ws/video`);
    }
  }, []);

  // 1. Start Camera
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not available. This is usually because the connection is not secure (HTTP instead of HTTPS). See the Troubleshooting guide.");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 } },
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


  // 2. Connect to WebSocket
  const connectSocket = () => {
    if (socket) socket.close();
    setStatus("connecting");
    
    // Normalize URL
    let url = serverUrl.replace(/^http/, "ws");
    if (!url.startsWith("ws")) url = `ws://${url}`;
    
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      setStatus("connected");
    };
    
    ws.onclose = () => {
      setStatus("disconnected");
    };
    
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus("error");
    };

    ws.onmessage = (event) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : null;
        if (data?.type === "vibrate" && Array.isArray(data.pattern) && navigator.vibrate) {
          navigator.vibrate(data.pattern);
        }
      } catch {
        // ignore non-JSON or parse errors
      }
    };

    setSocket(ws);
  };

  // 3. Send Frames Loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isStreaming && socket && socket.readyState === WebSocket.OPEN) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      intervalId = setInterval(() => {
        if (!videoRef.current || !ctx) return;
        
        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          // Downscale for network performance - 320px width is enough for preview
          const scale = 320 / video.videoWidth;
          canvas.width = 320;
          canvas.height = video.videoHeight * scale;
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Low quality jpeg
          const base64 = canvas.toDataURL("image/jpeg", 0.4); 
          
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(base64);
          }
        }
      }, 100); // 10 FPS
    }

    return () => clearInterval(intervalId);
  }, [isStreaming, socket]);

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold">Student Cam</h1>
        <ConnectionStatus status={status} />
      </div>
      
      {/* Connection Controls */}
      <div className="mb-4 space-y-2 bg-gray-900 p-3 rounded-lg border border-gray-800">
        <label className="text-xs text-gray-400 uppercase font-semibold">Server Address</label>
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

      {/* Camera Preview */}
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay controls */}
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <button 
              onClick={startCamera}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg transform transition active:scale-95 flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Start Camera
            </button>
          </div>
        )}
        
        {isStreaming && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
             <div className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1 rounded-full border border-white/20">
               Live Streaming
             </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 text-center text-gray-500 text-xs">
        Ensure phone and dashboard are on the same Wi-Fi
      </div>
    </div>
  );
}
