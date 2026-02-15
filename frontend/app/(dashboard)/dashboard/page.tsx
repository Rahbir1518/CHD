"use client";

import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import ConnectionStatus from "@/components/ConnectionStatus";
import PhonemeTimeline from "@/components/PhonemeTimeline";
import RecordingControls from "@/components/RecordingControls";
import TranscriptionPanel from "@/components/TranscriptionPanel";
import LipReadingPanel from "@/components/LipReadingPanel";
import PitchAnalysisPanel from "@/components/PitchAnalysisPanel";
import type { RecordedFrame } from "@/lib/storage";

const WaveVisualizer3D = lazy(() => import("@/components/WaveVisualizer3D"));

/* ─── Types ──────────────────────────────────────────────────────────────── */

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

/* ─── Stat Pill ──────────────────────────────────────────────────────────── */

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
        accent
          ? "bg-[#B87333]/15 text-[#D4A574] border border-[#B87333]/25"
          : "bg-white/5 text-gray-400 border border-white/5"
      }`}
    >
      <span className="uppercase tracking-wider text-[10px] text-gray-500 font-sans font-semibold">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────────────── */

function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="font-display font-semibold text-sm text-gray-200 tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Card Wrapper ───────────────────────────────────────────────────────── */

function Card({
  children,
  className = "",
  noPad = false,
}: {
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}) {
  return (
    <div
      className={`bg-black/40 rounded-xl border border-white/[0.06] shadow-lg backdrop-blur-sm transition-colors hover:border-white/10 ${
        noPad ? "" : "p-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Haptic Event Row ───────────────────────────────────────────────────── */

function HapticEventRow({ evt }: { evt: HapticEvent }) {
  const typeColor: Record<string, string> = {
    vowel: "text-emerald-400",
    consonant: "text-sky-400",
    buzz: "text-amber-400",
    silence: "text-gray-500",
  };

  return (
    <div className="flex items-center justify-between text-xs px-3 py-2 bg-white/[0.03] rounded-lg border border-white/[0.04] group hover:border-[#B87333]/20 transition-colors">
      <span
        className={`font-mono font-semibold tracking-wide ${
          typeColor[evt.phoneme_type] ?? "text-[#D4A574]"
        }`}
      >
        {evt.phoneme_type?.toUpperCase()}
      </span>
      <span className="text-gray-600 font-mono text-[11px] group-hover:text-gray-400 transition-colors">
        [{evt.pattern?.join(", ")}]
      </span>
      <span className="text-gray-500 font-mono">
        {(evt.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

/* ─── Tab Button ─────────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
        active
          ? "bg-[#B87333]/20 text-[#D4A574] border border-[#B87333]/30"
          : "text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ─── MAIN PAGE ──────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════════════════ */

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

  // UI state
  const [rightPanelTab, setRightPanelTab] = useState<"controls" | "haptics" | "recording" | "transcribe">("controls");

  const wsRef = useRef<WebSocket | null>(null);

  /* ── Mouth openness calculation ─────────────────────────────────────── */

  const calcMouthOpenness = useCallback((lm: LipLandmark[]) => {
    const top = lm.find((l) => l.index === 13);
    const bottom = lm.find((l) => l.index === 14);
    if (top && bottom) return Math.abs(bottom.y - top.y);
    return 0;
  }, []);

  /* ── WebSocket connection ───────────────────────────────────────────── */

  useEffect(() => {
    setStatus("connecting");
    const base =
      process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
        .replace(/^http/, "ws")
        .replace(/\/$/, "");
    const ws = new WebSocket(
      `${base.startsWith("ws") ? base : `ws://${base.replace(/^https?:\/\//, "")}`}/ws/viewer`
    );
    wsRef.current = ws;
    let frames = 0;

    const fpsInterval = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.frame_base64) {
          const src = data.frame_base64.startsWith("data:")
            ? data.frame_base64
            : `data:image/jpeg;base64,${data.frame_base64}`;
          if (!isPlayingRecording) setFrameSrc(src);
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

          if (data.mouth_state && !isPlayingRecording) {
            setMouthState(data.mouth_state);
          }
        }

        if (data.type === "haptic_feedback") {
          setCurrentPhoneme(data.phoneme_type);
          setCurrentHapticPattern(data.pattern || null);
          setHapticLog((prev) => [...prev.slice(-19), data]);

          if (navigator.vibrate && data.pattern?.length > 0) {
            navigator.vibrate(data.pattern);
          }

          const duration = (data.pattern || []).reduce(
            (a: number, b: number) => a + b,
            0
          );
          setTimeout(() => {
            setCurrentPhoneme(null);
            setCurrentHapticPattern(null);
          }, duration + 300);
        }

        if (data.type === "lip_reading") {
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
            setLipReadingHistory((prev) => [...prev.slice(-19), entry]);
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

  /* ── Helper: send control message ───────────────────────────────────── */

  const sendControl = (action: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "control", action, ...payload }));
    }
  };

  /* ── Fetch available lessons ────────────────────────────────────────── */

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

  /* ── Recording playback handlers ────────────────────────────────────── */

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

  /* ── Derived values ─────────────────────────────────────────────────── */

  const waveIntensity = currentPhoneme
    ? 0.7 + mouthOpenness * 3
    : mouthOpenness > 0.01
    ? mouthOpenness * 4
    : 0.08;

  /* ═══════════════════════════════════════════════════════════════════════ */
  /* ─── RENDER ───────────────────────────────────────────────────────── */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="glass-panel border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-lg font-bold tracking-tight">
            <span className="gradient-text">HapticPhonix</span>
            <span className="text-gray-500 font-normal ml-2 text-sm">Dashboard</span>
          </h1>
          {isPlayingRecording && (
            <span className="text-[10px] bg-[#B87333]/15 text-[#D4A574] px-2.5 py-1 rounded-full animate-pulse border border-[#B87333]/20 font-medium uppercase tracking-wider">
              Replaying
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`text-[11px] px-3 py-1.5 rounded-full border font-medium transition-all ${
              showOverlay
                ? "bg-emerald-900/25 border-emerald-700/40 text-emerald-400"
                : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-300"
            }`}
          >
            {showOverlay ? "Overlay On" : "Overlay Off"}
          </button>
          <div className="flex items-center gap-2">
            <StatPill label="FPS" value={fps} />
            <StatPill label="Pts" value={landmarkCount} />
          </div>
          <ConnectionStatus status={status} />
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 p-5 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1440px] mx-auto">
          {/* ═════════════ LEFT COLUMN ═════════════ */}
          <div className="lg:col-span-7 space-y-5">
            {/* Live Camera Feed */}
            <Card noPad className="overflow-hidden">
              <div className="p-1">
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
              </div>
              <div className="px-4 py-3 flex justify-between items-center border-t border-white/[0.04]">
                <div>
                  <h2 className="font-display font-semibold text-sm text-gray-200">
                    Live Camera Feed
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {landmarks.length > 0
                      ? `Tracking ${landmarks.length} lip landmarks \u00B7 Bounding box ${
                          lipBoundingBox ? "active" : "inactive"
                        } \u00B7 ${mouthState}`
                      : "Waiting for face detection\u2026"}
                  </p>
                </div>
                {mouthOpenness > 0 && (
                  <div className="text-[11px] text-gray-500 font-mono">
                    Openness: {(mouthOpenness * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </Card>

            {/* Three.js Wave Visualizer */}
            <Card noPad className="overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <SectionHeader
                  title="Haptic Wave Analysis"
                  subtitle="Real-time visualization reacts to phoneme detection and mouth movement"
                />
                {currentPhoneme && (
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#B87333]/15 text-[#D4A574] border border-[#B87333]/20 font-mono font-semibold uppercase tracking-wider animate-pulse">
                    {currentPhoneme}
                  </span>
                )}
              </div>
              <Suspense
                fallback={
                  <div className="h-[180px] flex items-center justify-center text-gray-600 text-xs">
                    Loading visualizer...
                  </div>
                }
              >
                <WaveVisualizer3D
                  intensity={Math.min(waveIntensity, 1)}
                  phonemeType={currentPhoneme}
                  height="180px"
                />
              </Suspense>
              {currentHapticPattern && (
                <div className="px-4 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                      Pattern
                    </span>
                    <div className="flex items-center gap-1">
                      {currentHapticPattern.map((ms, i) => (
                        <div
                          key={i}
                          className={`h-3 rounded-sm transition-all ${
                            i % 2 === 0
                              ? "bg-[#B87333] animate-vibrate"
                              : "bg-gray-700"
                          }`}
                          style={{ width: `${Math.max(ms / 8, 3)}px` }}
                          title={`${ms}ms ${i % 2 === 0 ? "on" : "off"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Transcript / Translation */}
            {(transcript || translation) && (
              <Card className="space-y-3">
                {transcript && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                      Speech
                    </span>
                    <p className="text-sm text-gray-200 mt-1 leading-relaxed">
                      {transcript}
                    </p>
                  </div>
                )}
                {translation && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#D4A574] font-semibold">
                      {targetLanguage} Translation
                    </span>
                    <p className="text-sm text-[#D4A574] mt-1 leading-relaxed">
                      {translation}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {/* Pitch Analysis */}
            <PitchAnalysisPanel />
          </div>

          {/* ═════════════ RIGHT COLUMN ═════════════ */}
          <div className="lg:col-span-5 space-y-5">
            {/* Lip Reading */}
            <Card>
              <SectionHeader
                title="Lip Reading AI"
                subtitle="Real-time visual speech recognition"
              />
              <LipReadingPanel
                latestResult={lipReadingResult}
                history={lipReadingHistory}
                isAnalyzing={isLipAnalyzing}
                mouthState={mouthState}
              />
            </Card>

            {/* Tabbed Panel */}
            <Card noPad>
              <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <TabButton
                    active={rightPanelTab === "controls"}
                    onClick={() => setRightPanelTab("controls")}
                  >
                    Session
                  </TabButton>
                  <TabButton
                    active={rightPanelTab === "haptics"}
                    onClick={() => setRightPanelTab("haptics")}
                  >
                    Haptic Log
                  </TabButton>
                  <TabButton
                    active={rightPanelTab === "recording"}
                    onClick={() => setRightPanelTab("recording")}
                  >
                    Record & Replay
                  </TabButton>
                  <TabButton
                    active={rightPanelTab === "transcribe"}
                    onClick={() => setRightPanelTab("transcribe")}
                  >
                    Transcribe
                  </TabButton>
                </div>
              </div>

              {/* ── Session Controls ─────────────────────────────── */}
              {rightPanelTab === "controls" && (
                <div className="p-4 space-y-4">
                  <SectionHeader title="Session Controls" />
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedLesson}
                      onChange={(e) => setSelectedLesson(e.target.value)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-sm bg-white/5 text-gray-200 focus:border-[#B87333]/40 focus:outline-none transition-colors"
                    >
                      {availableLessons.map((l) => (
                        <option key={l} value={l}>
                          {l.replace(".json", "")}
                        </option>
                      ))}
                      {availableLessons.length === 0 && (
                        <option value="sample_lesson.json">sample_lesson</option>
                      )}
                    </select>
                    <button
                      onClick={loadLesson}
                      className="bg-[#B87333] hover:bg-[#D4A574] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Load Lesson
                    </button>
                    <button
                      onClick={() =>
                        sendControl("start_playback", { start_time: 0 })
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Start Lesson
                    </button>
                    <button
                      onClick={() => sendControl("pause_playback")}
                      className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() =>
                        fetch(
                          `${
                            process.env.NEXT_PUBLIC_API_URL ||
                            "http://localhost:8000"
                          }/haptic/test`,
                          { method: "POST" }
                        ).catch(() => {})
                      }
                      className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      title="Send test vibration to connected phones"
                    >
                      Test Haptic
                    </button>
                  </div>

                  <PhonemeTimeline
                    currentPhoneme={currentPhoneme}
                    mouthOpenness={mouthOpenness}
                  />

                  {/* Connection details */}
                  <div className="mt-4 pt-4 border-t border-white/[0.04]">
                    <SectionHeader title="Connection" />
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="flex justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                        <span className="text-gray-500">Status</span>
                        <span
                          className={`font-semibold uppercase ${
                            status === "connected"
                              ? "text-emerald-400"
                              : status === "error"
                              ? "text-red-400"
                              : "text-gray-400"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="flex justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                        <span className="text-gray-500">Landmarks</span>
                        <span className="text-gray-300">{landmarkCount}</span>
                      </div>
                      <div className="flex justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                        <span className="text-gray-500">Lip BBox</span>
                        <span className="text-gray-300">
                          {lipBoundingBox ? "Active" : "None"}
                        </span>
                      </div>
                      <div className="flex justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                        <span className="text-gray-500">Mouth</span>
                        <span className="text-gray-300 capitalize">
                          {mouthState}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Haptic Event Log ─────────────────────────────── */}
              {rightPanelTab === "haptics" && (
                <div className="p-4">
                  <SectionHeader
                    title="Haptic Feedback Log"
                    subtitle={`${hapticLog.length} events captured`}
                    actions={
                      hapticLog.length > 0 ? (
                        <button
                          onClick={() => setHapticLog([])}
                          className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Clear
                        </button>
                      ) : undefined
                    }
                  />
                  {hapticLog.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-gray-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.788m13.788 0c3.808 3.808 3.808 9.98 0 13.788M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-500">
                        No haptic events yet. Start a lesson to feel vibrations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                      {hapticLog
                        .slice()
                        .reverse()
                        .map((evt, i) => (
                          <HapticEventRow key={i} evt={evt} />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Record & Replay ──────────────────────────────── */}
              {rightPanelTab === "recording" && (
                <div className="p-4">
                  <SectionHeader title="Record & Replay" />
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

              {/* ── Transcribe ───────────────────────────────────── */}
              {rightPanelTab === "transcribe" && (
                <div className="p-4">
                  <SectionHeader title="Transcribe" />
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
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}