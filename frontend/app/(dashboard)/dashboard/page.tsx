"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import ConnectionStatus from "@/components/ConnectionStatus";
import PhonemeTimeline from "@/components/PhonemeTimeline";
import RecordingControls from "@/components/RecordingControls";
import TranscriptionPanel from "@/components/TranscriptionPanel";
import type { RecordedFrame } from "@/lib/storage";

interface LipLandmark {
  x: number;
  y: number;
  z: number;
  index: number;
}

interface LipBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HapticEvent {
  type: string;
  pattern: number[];
  phoneme_type: string;
  confidence: number;
}

export default function DashboardPage() {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<LipLandmark[]>([]);
  const [lipBoundingBox, setLipBoundingBox] = useState<LipBoundingBox | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [fps, setFps] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const [currentPhoneme, setCurrentPhoneme] = useState<string | null>(null);
  const [currentHapticPattern, setCurrentHapticPattern] = useState<number[] | null>(null);
  const [hapticLog, setHapticLog] = useState<HapticEvent[]>([]);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "recording" | "transcription">("overview");
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const calcMouthOpenness = useCallback((lm: LipLandmark[]) => {
    const top = lm.find(l => l.index === 13);
    const bottom = lm.find(l => l.index === 14);
    if (top && bottom) return Math.abs(bottom.y - top.y);
    return 0;
  }, []);
  
  useEffect(() => {
    setStatus("connecting");
    const ws = new WebSocket("ws://localhost:8000/ws/viewer");
    wsRef.current = ws;
    let frames = 0;
    
    const fpsInterval = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);

    ws.onopen = () => {
      setStatus("connected");
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.frame_base64) {
          const src = data.frame_base64.startsWith('data:') 
            ? data.frame_base64 
            : `data:image/jpeg;base64,${data.frame_base64}`;

          if (!isPlayingRecording) {
            setFrameSrc(src);
          }
          frames++;
          
          if (data.landmarks && data.landmarks.length > 0) {
            if (!isPlayingRecording) {
              setLandmarks(data.landmarks);
              setLandmarkCount(data.landmark_count || data.landmarks.length);
              setMouthOpenness(calcMouthOpenness(data.landmarks));
            }
          } else if (!isPlayingRecording) {
            setLandmarks([]);
            setLandmarkCount(0);
            setMouthOpenness(0);
          }

          if (data.lip_bounding_box && !isPlayingRecording) {
            setLipBoundingBox(data.lip_bounding_box);
          } else if (!isPlayingRecording) {
            setLipBoundingBox(null);
          }
        }
        
        if (data.type === 'haptic_feedback') {
          setCurrentPhoneme(data.phoneme_type);
          setCurrentHapticPattern(data.pattern || null);
          setHapticLog(prev => [...prev.slice(-19), data]);
          
          if (navigator.vibrate && data.pattern?.length > 0) {
            navigator.vibrate(data.pattern);
          }
          
          const duration = (data.pattern || []).reduce((a: number, b: number) => a + b, 0);
          setTimeout(() => {
            setCurrentPhoneme(null);
            setCurrentHapticPattern(null);
          }, duration + 300);
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
  }, [calcMouthOpenness, isPlayingRecording]);

  const sendControl = (action: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'control', action, ...payload }));
    }
  };

  // Recording playback handlers
  const handlePlaybackFrame = useCallback((frame: RecordedFrame) => {
    setFrameSrc(frame.frameSrc);
    setLandmarks(frame.landmarks);
    setLipBoundingBox(frame.lipBoundingBox);
    setMouthOpenness(frame.mouthOpenness);
    if (frame.phoneme) setCurrentPhoneme(frame.phoneme);
  }, []);

  const handlePlaybackHaptic = useCallback((pattern: number[]) => {
    setCurrentHapticPattern(pattern);
    if (navigator.vibrate) navigator.vibrate(pattern);
    const dur = pattern.reduce((a, b) => a + b, 0);
    setTimeout(() => setCurrentHapticPattern(null), dur + 100);
  }, []);

  const handlePlaybackStop = useCallback(() => {
    setIsPlayingRecording(false);
  }, []);

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "recording" as const, label: "Record & Replay" },
    { key: "transcription" as const, label: "Transcribe" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      {/* Sticky Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            HapticPhonix <span className="text-gray-400 font-normal">Dashboard</span>
          </h1>
          {isPlayingRecording && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full animate-pulse border border-indigo-200">
              Replaying Recording
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showOverlay 
                ? 'bg-green-50 border-green-300 text-green-700' 
                : 'bg-gray-50 border-gray-300 text-gray-500'
            }`}
          >
            {showOverlay ? '🎯 Overlay ON' : '○ Overlay OFF'}
          </button>
          <div className="text-xs font-mono text-gray-500">
            {fps} FPS · {landmarkCount} pts
          </div>
          <ConnectionStatus status={status} />
        </div>
      </header>
      
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          {/* Live Stream Card with Bounding Box + Landmarks Overlay */}
          <div className="space-y-4">
            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <VideoPlayer 
                frameSrc={frameSrc} 
                status={status} 
                landmarks={landmarks}
                showOverlay={showOverlay}
                mouthOpenness={mouthOpenness}
                currentPhoneme={currentPhoneme}
                lipBoundingBox={lipBoundingBox}
              />
              <div className="p-3 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-sm text-gray-700">Live Camera Feed</h2>
                  <p className="text-xs text-gray-500">
                    {landmarks.length > 0 
                      ? `Tracking ${landmarks.length} lip landmarks · Bounding box ${lipBoundingBox ? 'active' : 'inactive'}`
                      : 'Waiting for face detection...'}
                  </p>
                </div>
                {mouthOpenness > 0 && (
                  <div className="text-xs text-gray-500 font-mono">
                    Openness: {(mouthOpenness * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>

            {/* Transcript/Translation under video */}
            {(transcript || translation) && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-2">
                {transcript && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Speech</span>
                    <p className="text-sm text-gray-800 mt-1">{transcript}</p>
                  </div>
                )}
                {translation && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold">
                      {targetLanguage} Translation
                    </span>
                    <p className="text-sm text-indigo-600 mt-1">{translation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right column - tabbed */}
          <div className="space-y-0">
            {/* Tabs */}
            <div className="flex bg-white rounded-t-xl border border-b-0 border-gray-200 overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-3 text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? "text-indigo-600 bg-indigo-50 border-b-2 border-indigo-500"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm">
              {/* ── Overview Tab ── */}
              {activeTab === "overview" && (
                <div className="p-6 space-y-6">
                  {/* Session Controls */}
                  <div>
                    <h2 className="font-semibold text-lg mb-4 text-gray-800">Session Controls</h2>
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <button onClick={() => sendControl('start_playback')}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          ▶ Start Lesson
                        </button>
                        <button onClick={() => sendControl('pause_playback')}
                          className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          ⏸ Pause
                        </button>
                        <button onClick={() => sendControl('load_lesson', { lesson_name: 'sample_lesson.json' })}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                          📚 Load Lesson
                        </button>
                      </div>
                      <PhonemeTimeline currentPhoneme={currentPhoneme} mouthOpenness={mouthOpenness} />
                    </div>
                  </div>
                  
                  {/* Haptic Event Log */}
                  <div>
                    <h2 className="font-semibold text-lg mb-4 text-gray-800">Haptic Feedback Log</h2>
                    {hapticLog.length === 0 ? (
                      <div className="p-4 bg-gray-50 text-gray-400 rounded-lg text-sm text-center">
                        No haptic events yet. Start a lesson to begin.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {hapticLog.slice().reverse().map((evt, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                            <span className="font-mono font-medium text-gray-700">{evt.phoneme_type}</span>
                            <span className="text-gray-400">Pattern: [{evt.pattern.join(', ')}]</span>
                            <span className="text-gray-500">{(evt.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Connection Details */}
                  <div>
                    <h2 className="font-semibold text-lg mb-4 text-gray-800">Connection Details</h2>
                    <div className="text-xs font-mono space-y-2 text-gray-600">
                      <div className="flex justify-between">
                        <span>WebSocket URL:</span>
                        <span>ws://localhost:8000/ws/viewer</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="uppercase font-semibold">{status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Landmarks:</span>
                        <span>{landmarkCount} detected</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lip BBox:</span>
                        <span>{lipBoundingBox ? 'Active' : 'None'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Recording Tab ── */}
              {activeTab === "recording" && (
                <div className="p-4">
                  <RecordingControls
                    isLive={status === "connected" && !!frameSrc}
                    currentFrameSrc={frameSrc}
                    currentLandmarks={landmarks}
                    currentBoundingBox={lipBoundingBox}
                    currentMouthOpenness={mouthOpenness}
                    currentPhoneme={currentPhoneme}
                    currentHapticPattern={currentHapticPattern}
                    onPlaybackFrame={handlePlaybackFrame}
                    onPlaybackHaptic={handlePlaybackHaptic}
                    onPlaybackStop={handlePlaybackStop}
                    transcript={transcript}
                    translation={translation}
                    targetLanguage={targetLanguage}
                  />
                </div>
              )}

              {/* ── Transcription Tab ── */}
              {activeTab === "transcription" && (
                <div className="p-4">
                  <TranscriptionPanel
                    isLive={status === "connected"}
                    onTranscript={(t) => setTranscript(t)}
                    onTranslation={(t, lang) => {
                      setTranslation(t);
                      setTargetLanguage(lang);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}