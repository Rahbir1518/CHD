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

interface Phoneme {
  id: string;
  type: string;
  character: string;
  word: string;
  start: number;
  duration: number;
}

export default function TeacherPage() {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<LipLandmark[]>([]);
  const [lipBoundingBox, setLipBoundingBox] = useState<LipBoundingBox | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [fps, setFps] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const [currentPhoneme, setCurrentPhoneme] = useState<string | null>(null);
  const [currentHapticPattern, setCurrentHapticPattern] = useState<number[] | null>(null);
  const [lessonPhonemes, setLessonPhonemes] = useState<Phoneme[]>([]);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [availableLessons, setAvailableLessons] = useState<string[]>([]);
  const [selectedLesson, setSelectedLesson] = useState("sample_lesson.json");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<"controls" | "recording" | "transcription">("controls");
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Calculate mouth openness from landmarks
  const calcMouthOpenness = useCallback((lm: LipLandmark[]) => {
    const top = lm.find(l => l.index === 13);
    const bottom = lm.find(l => l.index === 14);
    if (top && bottom) return Math.abs(bottom.y - top.y);
    return 0;
  }, []);

  // Fetch available lessons
  useEffect(() => {
    fetch("http://localhost:8000/lessons")
      .then(r => r.json())
      .then(data => {
        if (data.lessons) setAvailableLessons(data.lessons);
      })
      .catch(() => {});
  }, []);

  // WebSocket connection
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
          const src = data.frame_base64.startsWith("data:")
            ? data.frame_base64
            : `data:image/jpeg;base64,${data.frame_base64}`;

          // Don't update live feed during recording playback
          if (!isPlayingRecording) {
            setFrameSrc(src);
          }
          frames++;

          if (data.landmarks?.length > 0) {
            if (!isPlayingRecording) {
              setLandmarks(data.landmarks);
              setMouthOpenness(calcMouthOpenness(data.landmarks));
            }
          } else if (!isPlayingRecording) {
            setLandmarks([]);
            setMouthOpenness(0);
          }

          // Update bounding box from backend
          if (data.lip_bounding_box && !isPlayingRecording) {
            setLipBoundingBox(data.lip_bounding_box);
          } else if (!isPlayingRecording) {
            setLipBoundingBox(null);
          }
        }

        if (data.type === "haptic_feedback") {
          setCurrentPhoneme(data.phoneme_type);
          setCurrentHapticPattern(data.pattern || null);
          const dur = (data.pattern || []).reduce((a: number, b: number) => a + b, 0);
          setTimeout(() => {
            setCurrentPhoneme(null);
            setCurrentHapticPattern(null);
          }, dur + 300);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");

    return () => {
      ws.close();
      clearInterval(fpsInterval);
    };
  }, [calcMouthOpenness, isPlayingRecording]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackTime(prev => prev + 0.05);
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const sendControl = (action: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "control", action, ...payload }));
    }
  };

  const loadLesson = async () => {
    try {
      await fetch(`http://localhost:8000/lessons/load/${selectedLesson}`, { method: "POST" });
      sendControl("load_lesson", { lesson_name: selectedLesson });
    } catch (e) {
      console.error("Failed to load lesson", e);
    }
  };

  const startPlayback = () => {
    setPlaybackTime(0);
    setIsPlaying(true);
    sendControl("start_playback", { start_time: 0 });
  };

  const pausePlayback = () => {
    setIsPlaying(false);
    sendControl("pause_playback");
  };

  // ── Recording playback handlers ──
  const handlePlaybackFrame = useCallback((frame: RecordedFrame) => {
    setFrameSrc(frame.frameSrc);
    setLandmarks(frame.landmarks);
    setLipBoundingBox(frame.lipBoundingBox);
    setMouthOpenness(frame.mouthOpenness);
    if (frame.phoneme) setCurrentPhoneme(frame.phoneme);
  }, []);

  const handlePlaybackHaptic = useCallback((pattern: number[]) => {
    setCurrentHapticPattern(pattern);
    // Vibrate if supported
    if (navigator.vibrate) navigator.vibrate(pattern);
    const dur = pattern.reduce((a, b) => a + b, 0);
    setTimeout(() => setCurrentHapticPattern(null), dur + 100);
  }, []);

  const handlePlaybackStop = useCallback(() => {
    setIsPlayingRecording(false);
  }, []);

  const tabs = [
    { key: "controls" as const, label: "Controls" },
    { key: "recording" as const, label: "Recording" },
    { key: "transcription" as const, label: "Transcription" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            HapticPhonix
          </h1>
          <span className="text-xs text-gray-500 border-l border-gray-700 pl-3">Teacher View</span>
          {isPlayingRecording && (
            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full animate-pulse">
              Replaying
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showOverlay
                ? "bg-green-900/30 border-green-600 text-green-400"
                : "bg-gray-800 border-gray-600 text-gray-400"
            }`}
          >
            {showOverlay ? "🎯 Overlay ON" : "○ Overlay OFF"}
          </button>
          <span className="text-xs font-mono text-gray-500">{fps} FPS</span>
          <ConnectionStatus status={status} />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left: Video panel */}
        <div className="flex-[3] p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Video with bounding box + landmarks overlay */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <VideoPlayer
              frameSrc={frameSrc}
              status={status}
              landmarks={landmarks}
              showOverlay={showOverlay}
              mouthOpenness={mouthOpenness}
              currentPhoneme={currentPhoneme}
              lipBoundingBox={lipBoundingBox}
            />
          </div>

          {/* Transcript + Translation display (always visible under video) */}
          {(transcript || translation) && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-2">
              {transcript && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">Transcript</span>
                  <p className="text-sm text-white mt-1">{transcript}</p>
                </div>
              )}
              {translation && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-indigo-500">
                    Translation ({targetLanguage})
                  </span>
                  <p className="text-sm text-indigo-300 mt-1">{translation}</p>
                </div>
              )}
            </div>
          )}

          {/* Landmark data panel */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Lip Landmark Data</h3>
            {landmarks.length > 0 ? (
              <div className="grid grid-cols-5 gap-2">
                {landmarks.map((lm) => (
                  <div
                    key={lm.index}
                    className={`p-2 rounded-lg text-center text-xs font-mono ${
                      lm.index === 0
                        ? "bg-red-900/30 border border-red-800"
                        : lm.index === 13 || lm.index === 14
                        ? "bg-green-900/30 border border-green-800"
                        : "bg-blue-900/30 border border-blue-800"
                    }`}
                  >
                    <div className="font-bold text-white">#{lm.index}</div>
                    <div className="text-gray-400 mt-1">x: {lm.x.toFixed(3)}</div>
                    <div className="text-gray-400">y: {lm.y.toFixed(3)}</div>
                    <div className="text-gray-400">z: {lm.z.toFixed(3)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-600 text-xs text-center py-4">
                No landmarks detected. Ensure a face is visible in the camera.
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabbed sidebar */}
        <div className="flex-[2] border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 bg-gray-900/50">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-indigo-400 border-b-2 border-indigo-400 bg-gray-900/80"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* ── Controls Tab ── */}
            {activeTab === "controls" && (
              <>
                {/* Lesson Selector */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Lesson</h3>
                  <div className="flex gap-2 mb-3">
                    <select
                      value={selectedLesson}
                      onChange={(e) => setSelectedLesson(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                      className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Load
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={startPlayback} disabled={isPlaying}
                      className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      ▶ Play
                    </button>
                    <button onClick={pausePlayback} disabled={!isPlaying}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      ⏸ Pause
                    </button>
                    <button onClick={() => { setIsPlaying(false); setPlaybackTime(0); sendControl("pause_playback"); }}
                      className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      ⏹
                    </button>
                  </div>
                </div>

                {/* Phoneme Timeline */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Phoneme Timeline</h3>
                  <PhonemeTimeline
                    currentPhoneme={currentPhoneme}
                    mouthOpenness={mouthOpenness}
                    phonemes={lessonPhonemes}
                    currentTime={playbackTime}
                  />
                </div>

                {/* Mouth Analysis */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Mouth Analysis</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Mouth Openness</span>
                        <span className="font-mono">{(mouthOpenness * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-green-500 to-emerald-400"
                          style={{ width: `${Math.min(mouthOpenness * 100, 100)}%` }} />
                      </div>
                    </div>

                    {landmarks.length > 0 && (() => {
                      const left = landmarks.find(l => l.index === 78);
                      const right = landmarks.find(l => l.index === 308);
                      const w = left && right ? Math.abs(right.x - left.x) : 0;
                      return (
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Lip Width</span>
                            <span className="font-mono">{(w * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-blue-500 to-indigo-400"
                              style={{ width: `${Math.min(w * 100 * 5, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bounding box info */}
                    {lipBoundingBox && (
                      <div className="text-xs text-gray-500 p-2 bg-gray-800 rounded-lg font-mono">
                        <span className="text-green-400">Lip BBox:</span>{" "}
                        x:{lipBoundingBox.x.toFixed(3)} y:{lipBoundingBox.y.toFixed(3)}{" "}
                        w:{lipBoundingBox.width.toFixed(3)} h:{lipBoundingBox.height.toFixed(3)}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">Current Sound:</span>
                      {currentPhoneme ? (
                        <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold animate-pulse">
                          {currentPhoneme.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600 italic">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Haptic Test */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Haptic Test</h3>
                  <p className="text-xs text-gray-600 mb-3">Send a test vibration to all connected phones.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["vowel", "consonant", "buzz", "silence"].map((type) => (
                      <button key={type}
                        onClick={() => {
                          fetch("http://localhost:8000/playback/start", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ start_time: 0 }),
                          }).catch(() => {});
                        }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                          type === "vowel" ? "bg-green-900/30 border border-green-700 text-green-400 hover:bg-green-900/50"
                          : type === "consonant" ? "bg-blue-900/30 border border-blue-700 text-blue-400 hover:bg-blue-900/50"
                          : type === "buzz" ? "bg-yellow-900/30 border border-yellow-700 text-yellow-400 hover:bg-yellow-900/50"
                          : "bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Recording Tab ── */}
            {activeTab === "recording" && (
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
            )}

            {/* ── Transcription Tab ── */}
            {activeTab === "transcription" && (
              <TranscriptionPanel
                isLive={status === "connected"}
                onTranscript={(t) => setTranscript(t)}
                onTranslation={(t, lang) => {
                  setTranslation(t);
                  setTargetLanguage(lang);
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}