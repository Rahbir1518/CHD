"use client";

import { useEffect, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import ConnectionStatus from "@/components/ConnectionStatus";

export default function DashboardPage() {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [fps, setFps] = useState(0);
  
  // Connect on mount
  useEffect(() => {
    setStatus("connecting");
    const ws = new WebSocket("ws://localhost:8000/ws/viewer");
    let frames = 0;
    
    // FPS Counter
    const fpsInterval = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);

    ws.onopen = () => {
      setStatus("connected");
      console.log("Dashboard connected to viewer socket");
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.frame_base64) {
          // Check if it's a raw base64 string or a data URL
          // Our main.py sends raw base64 usually, but student sends data URL.
          // Let's handle both.
          const src = data.frame_base64.startsWith('data:') 
            ? data.frame_base64 
            : `data:image/jpeg;base64,${data.frame_base64}`;
          
          setFrameSrc(src);
          frames++;
        }
      } catch (err) {
        console.error("Error parsing message", err);
      }
    };
    
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    
    return () => {
      ws.close();
      clearInterval(fpsInterval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      {/* Sticky Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          HapticPhonix <span className="text-gray-400 font-normal">Dashboard</span>
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-gray-500">
            {fps} FPS
          </div>
          <ConnectionStatus status={status} />
        </div>
      </header>
      
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {/* Live Stream Card */}
          <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <VideoPlayer frameSrc={frameSrc} status={status} />
            <div className="p-3">
              <h2 className="font-semibold text-sm text-gray-700">Live Camera Feed</h2>
              <p className="text-xs text-gray-500">Streaming from student device via WebSocket</p>
            </div>
          </div>
          
          {/* Controls / Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="font-semibold text-lg mb-4 text-gray-800">Session Controls</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  Waiting for phoneme engine integration...
                </div>
                {/* Placeholders for future controls */}
                <div className="h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                  Phoneme Timeline Visualization
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="font-semibold text-lg mb-4 text-gray-800">Connection Details</h2>
              <div className="text-xs font-mono space-y-2 text-gray-600">
                <div className="flex justify-between">
                  <span>WebSocket URL:</span>
                  <span>ws://localhost:8000/ws/viewer</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="uppercase">{status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}