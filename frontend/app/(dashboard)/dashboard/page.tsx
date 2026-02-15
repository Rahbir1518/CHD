"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import ConnectionStatus from "@/components/ConnectionStatus";
import PhonemeTimeline from "@/components/PhonemeTimeline";
import RecordingControls from "@/components/RecordingControls";
import TranscriptionPanel from "@/components/TranscriptionPanel";
import LipReadingPanel from "@/components/LipReadingPanel";
import PitchAnalysisPanel from "@/components/PitchAnalysisPanel";
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

interface LipReadingEntry {
  detected_text: string;
  confidence: number;
  mouth_state: string;
  phonemes_detected: string[];
  analysis_notes: string;
  timestamp: number;
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
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [availableLessons, setAvailableLessons] = useState<string[]>([]);
  const [selectedLesson, setSelectedLesson] = useState("sample_lesson.json");
  
  // Lip reading state
  const [mouthState, setMouthState] = useState("unknown");
  const [lipReadingResult, setLipReadingResult] = useState<LipReadingEntry | null>(null);
  const [lipReadingHistory, setLipReadingHistory] = useState<LipReadingEntry[]>([]);
  const [isLipAnalyzing, setIsLipAnalyzing] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  const calcMouthOpenness = useCallback((lm: LipLandmark[]) => {
    const top = lm.find(l => l.index === 13);
    const bottom = lm.find(l => l.index === 14);
    if (top && bottom) return Math.abs(bottom.y - top.y);
    return 0;
  }, []);
  
  useEffect(() => {
    setStatus("connecting");
    const base =
      process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/^http/, "ws").replace(/\/$/, "");
    const ws = new WebSocket(`${base.startsWith("ws") ? base : `ws://${base.replace(/^https?:\/\//, "")}`}/ws/viewer`);
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
        
        // Video frame data
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
          
          // Mouth state from movement tracking
          if (data.mouth_state && !isPlayingRecording) {
            setMouthState(data.mouth_state);
          }
        }
        
        // Haptic feedback events
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
        
        // Lip reading analysis results from Gemini
        if (data.type === 'lip_reading') {
          const entry: LipReadingEntry = {
            detected_text: data.detected_text || "",
            confidence: data.confidence || 0,
            mouth_state: data.mouth_state || "unknown",
            phonemes_detected: data.phonemes_detected || [],
            analysis_notes: data.analysis_notes || "",
            timestamp: data.timestamp || Date.now() / 1000,
          };
          setLipReadingResult(entry);
          setIsLipAnalyzing(false);
          if (entry.detected_text) {
            setLipReadingHistory(prev => [...prev.slice(-19), entry]);
          }
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
      wsRef.current.send(JSON.stringify({ type: "control", action, ...payload }));
    }
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/lessons`)
      .then((r) => r.json())
      .then((data) => {
        if (data.lessons?.length) setAvailableLessons(data.lessons);
      })
      .catch(() => {});
  }, []);

  const loadLesson = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/lessons/load/${selectedLesson}`,
        { method: "POST" }
      );
      sendControl("load_lesson", { lesson_name: selectedLesson });
    } catch (e) {
      console.error("Failed to load lesson", e);
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

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Sticky Header */}
      <header className="glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#B87333] to-[#D4A574]">
            HapticPhonix <span className="text-gray-500 font-normal">Dashboard</span>
          </h1>
          {isPlayingRecording && (
            <span className="text-xs bg-[#B87333]/20 text-[#D4A574] px-2 py-0.5 rounded-full animate-pulse border border-[#B87333]/30">
              Replaying Recording
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showOverlay 
                ? 'bg-green-900/30 border-green-700 text-green-400' 
                : 'bg-gray-900 border-gray-700 text-gray-500'
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
            <div className="bg-black/40 p-1 rounded-xl shadow-sm border border-white/10 overflow-hidden">
              <VideoPlayer 
                frameSrc={frameSrc} 
                status={status} 
                landmarks={landmarks}
                showOverlay={showOverlay}
                mouthOpenness={mouthOpenness}
                currentPhoneme={currentPhoneme}
                lipBoundingBox={lipBoundingBox}
                mouthState={mouthState}
                lipReadingText={lipReadingResult?.detected_text || null}
              />
              <div className="p-3 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold text-sm text-gray-200">Live Camera Feed</h2>
                  <p className="text-xs text-gray-500">
                    {landmarks.length > 0 
                      ? `Tracking ${landmarks.length} lip landmarks · Bounding box ${lipBoundingBox ? 'active' : 'inactive'} · ${mouthState}`
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
              <div className="bg-black/40 p-4 rounded-xl shadow-sm border border-white/10 space-y-2">
                {transcript && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Speech</span>
                    <p className="text-sm text-gray-200 mt-1">{transcript}</p>
                  </div>
                )}
                {translation && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#D4A574] font-semibold">
                      {targetLanguage} Translation
                    </span>
                    <p className="text-sm text-[#D4A574] mt-1">{translation}</p>
                  </div>
                )}
              </div>
            )}

            {/* Real-Time Pitch Analysis Audiogram */}
            <PitchAnalysisPanel />
          </div>
          
          {/* Right column */}
          <div className="space-y-6">
            {/* Lip Reading Panel — NEW */}
            <div className="bg-black/40 rounded-xl border border-white/10 shadow-sm overflow-hidden p-4">
              <h2 className="font-semibold text-lg mb-3 text-[#D4A574]">👄 Lip Reading AI</h2>
              <LipReadingPanel
                latestResult={lipReadingResult}
                history={lipReadingHistory}
                isAnalyzing={isLipAnalyzing}
                mouthState={mouthState}
              />
            </div>

            <div className="bg-black/40 rounded-xl border border-white/10 shadow-sm overflow-hidden">
              {/* Session controls */}
              <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold text-lg mb-3 text-gray-200">Session Controls</h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <select
                    value={selectedLesson}
                    onChange={(e) => setSelectedLesson(e.target.value)}
                    className="rounded-lg border border-gray-700 px-3 py-2 text-sm bg-gray-900 text-gray-200"
                  >
                    {availableLessons.map((l) => (
                      <option key={l} value={l}>{l.replace(".json", "")}</option>
                    ))}
                    {availableLessons.length === 0 && (
                      <option value="sample_lesson.json">sample_lesson</option>
                    )}
                  </select>
                  <button
                    onClick={loadLesson}
                    className="bg-[#B87333] hover:bg-[#D4A574] text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Load Lesson
                  </button>
                  <button
                    onClick={() => sendControl("start_playback", { start_time: 0 })}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    ▶ Start Lesson
                  </button>
                  <button
                    onClick={() => sendControl("pause_playback")}
                    className="bg-yellow-500 hover:bg-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={() =>
                      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/haptic/test`, {
                        method: "POST",
                      }).catch(() => {})
                    }
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    title="Send test vibration to connected phones"
                  >
                    📳 Test Haptic
                  </button>
                </div>
                <PhonemeTimeline currentPhoneme={currentPhoneme} mouthOpenness={mouthOpenness} />
              </div>

              {/* Haptic log */}
              <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold text-lg mb-3 text-gray-200">Haptic Feedback Log</h2>
                {hapticLog.length === 0 ? (
                  <div className="p-3 bg-gray-900 text-gray-500 rounded-lg text-sm text-center">
                    No haptic events yet. Start a lesson or use the phone to feel vibrations.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {hapticLog.slice().reverse().map((evt, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-900 rounded">
                        <span className="font-mono font-medium text-[#D4A574]">{evt.phoneme_type}</span>
                        <span className="text-gray-400">[{evt.pattern?.join(", ")}]</span>
                        <span className="text-gray-500">{(evt.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Connection details */}
              <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold text-sm mb-2 text-gray-300">Connection</h2>
                <div className="text-xs font-mono space-y-1 text-gray-400">
                  <div className="flex justify-between"><span>Status</span><span className="uppercase font-semibold">{status}</span></div>
                  <div className="flex justify-between"><span>Landmarks</span><span>{landmarkCount}</span></div>
                  <div className="flex justify-between"><span>Lip BBox</span><span>{lipBoundingBox ? "Active" : "None"}</span></div>
                  <div className="flex justify-between"><span>Mouth State</span><span className="capitalize">{mouthState}</span></div>
                </div>
              </div>

              {/* Record & Replay */}
              <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold text-lg mb-3 text-gray-200">Record & Replay</h2>
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

              {/* Transcribe */}
              <div className="p-4">
                <h2 className="font-semibold text-lg mb-3 text-gray-200">Transcribe</h2>
                <TranscriptionPanel
                  isLive={status === "connected"}
                  onTranscript={(t) => setTranscript(t)}
                  onTranslation={(t, lang) => {
                    setTranslation(t);
                    setTargetLanguage(lang);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}