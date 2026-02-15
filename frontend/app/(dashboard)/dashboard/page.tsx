"use client";

import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

/* ─── Animation Variants ─────────────────────────────────────────────────── */

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

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
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
        accent
          ? "bg-[#B87333]/15 text-[#D4A574] border border-[#B87333]/30 shadow-[0_0_12px_rgba(184,115,51,0.15)]"
          : "bg-white/[0.04] text-gray-400 border border-white/[0.06]"
      }`}
    >
      <span className="uppercase tracking-wider text-[10px] text-gray-500 font-sans font-semibold">
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </motion.div>
  );
}

/* ─── Section Header ─────────────────────────────────────────────────────── */

function SectionHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-[#B87333]/15 border border-[#B87333]/20 flex items-center justify-center text-[#D4A574]">
            {icon}
          </div>
        )}
        <div>
          <h2 className="font-display font-semibold text-sm text-gray-200 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
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
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      custom={delay}
      variants={fadeInUp}
      className={`dash-card rounded-xl ${noPad ? "" : "p-4"} ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ─── Haptic Event Row ───────────────────────────────────────────────────── */

function HapticEventRow({ evt, index }: { evt: HapticEvent; index: number }) {
  const typeConfig: Record<string, { color: string; bg: string }> = {
    vowel: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
    consonant: { color: "text-sky-400", bg: "bg-sky-500/10" },
    buzz: { color: "text-amber-400", bg: "bg-amber-500/10" },
    silence: { color: "text-gray-500", bg: "bg-gray-500/5" },
  };

  const config = typeConfig[evt.phoneme_type] ?? { color: "text-[#D4A574]", bg: "bg-[#B87333]/10" };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={`flex items-center justify-between text-xs px-3 py-2.5 ${config.bg} rounded-lg border border-white/[0.04] group hover:border-[#B87333]/25 transition-all duration-300`}
    >
      <span className={`font-mono font-bold tracking-wide text-[11px] ${config.color}`}>
        {evt.phoneme_type?.toUpperCase()}
      </span>
      <div className="flex items-center gap-1.5">
        {evt.pattern?.map((ms, i) => (
          <div
            key={i}
            className={`h-2.5 rounded-sm ${i % 2 === 0 ? "bg-[#B87333]/60" : "bg-gray-700/60"}`}
            style={{ width: `${Math.max(ms / 10, 2)}px` }}
          />
        ))}
      </div>
      <span className="text-gray-500 font-mono text-[11px]">
        {(evt.confidence * 100).toFixed(0)}%
      </span>
    </motion.div>
  );
}

/* ─── Tab Button ─────────────────────────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative text-xs px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
        active
          ? "bg-[#B87333]/15 text-[#D4A574] border border-[#B87333]/30 shadow-[0_0_16px_rgba(184,115,51,0.1)]"
          : "text-gray-500 hover:text-gray-300 border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]"
      }`}
    >
      {icon}
      {children}
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-transparent via-[#B87333] to-transparent rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </motion.button>
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
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-100 overflow-hidden">
      {/* Grain Overlay */}
      <div className="grain-overlay" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-30"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <motion.div
              whileHover={{ rotate: 12, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#B87333] to-[#D4A574] flex items-center justify-center shadow-[0_0_16px_rgba(184,115,51,0.3)]"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.55a1 1 0 00.9 1.45h12.76a1 1 0 00.9-1.45l-5.069-10.127A2 2 0 0114 9.527V2" />
              </svg>
            </motion.div>
            <h1 className="font-display text-lg font-bold tracking-tight">
              <span className="gradient-text">HapticPhonix</span>
              <span className="text-gray-600 font-normal ml-2 text-sm">Dashboard</span>
            </h1>
          </div>
          <AnimatePresence>
            {isPlayingRecording && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] bg-[#B87333]/15 text-[#D4A574] px-3 py-1 rounded-full animate-copper-pulse border border-[#B87333]/25 font-semibold uppercase tracking-wider"
              >
                Replaying
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowOverlay(!showOverlay)}
            className={`text-[11px] px-4 py-1.5 rounded-full border font-medium transition-all ${
              showOverlay
                ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-white/[0.03] border-white/[0.08] text-gray-500 hover:text-gray-300"
            }`}
          >
            {showOverlay ? "\u25C9 Overlay" : "\u25CB Overlay"}
          </motion.button>
          <div className="flex items-center gap-2">
            <StatPill label="FPS" value={fps} accent={fps > 0} />
            <StatPill label="Pts" value={landmarkCount} />
          </div>
          <ConnectionStatus status={status} />
        </div>
      </motion.header>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 p-5 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-[1440px] mx-auto">
          {/* ═════════════ LEFT COLUMN ═════════════ */}
          <div className="lg:col-span-7 space-y-5">
            {/* Live Camera Feed */}
            <Card noPad className="overflow-hidden" delay={0}>
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
                  <h2 className="font-display font-semibold text-sm text-gray-200 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#D4A574]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
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
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                    <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#B87333] to-[#D4A574]"
                        animate={{ width: `${Math.min(mouthOpenness * 100, 100)}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    {(mouthOpenness * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </Card>

            {/* Three.js Wave Visualizer */}
            <Card noPad className="overflow-hidden" delay={1}>
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <SectionHeader
                  title="Haptic Wave Analysis"
                  subtitle="Real-time visualization reacts to phoneme detection and mouth movement"
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  }
                />
                <AnimatePresence>
                  {currentPhoneme && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="text-[10px] px-3 py-1.5 rounded-full bg-[#B87333]/20 text-[#D4A574] border border-[#B87333]/30 font-mono font-bold uppercase tracking-wider animate-copper-pulse"
                    >
                      {currentPhoneme}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <Suspense
                fallback={
                  <div className="h-[180px] flex items-center justify-center text-gray-600 text-xs">
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Loading visualizer...
                    </motion.div>
                  </div>
                }
              >
                <WaveVisualizer3D
                  intensity={Math.min(waveIntensity, 1)}
                  phonemeType={currentPhoneme}
                  height="180px"
                />
              </Suspense>
              <AnimatePresence>
                {currentHapticPattern && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        Pattern
                      </span>
                      <div className="flex items-center gap-1">
                        {currentHapticPattern.map((ms, i) => (
                          <motion.div
                            key={i}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className={`h-3.5 rounded-sm ${
                              i % 2 === 0
                                ? "bg-gradient-to-t from-[#B87333] to-[#D4A574] animate-vibrate"
                                : "bg-gray-700/50"
                            }`}
                            style={{ width: `${Math.max(ms / 8, 3)}px` }}
                            title={`${ms}ms ${i % 2 === 0 ? "on" : "off"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Transcript / Translation */}
            <AnimatePresence>
              {(transcript || translation) && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={scaleIn}
                >
                  <Card className="space-y-3" delay={2}>
                    {transcript && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          Speech
                        </span>
                        <p className="text-sm text-gray-200 mt-1.5 leading-relaxed">
                          {transcript}
                        </p>
                      </div>
                    )}
                    {translation && (
                      <div className="pt-2 border-t border-white/[0.04]">
                        <span className="text-[10px] uppercase tracking-wider text-[#D4A574] font-semibold flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          {targetLanguage} Translation
                        </span>
                        <p className="text-sm text-[#D4A574] mt-1.5 leading-relaxed">
                          {translation}
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pitch Analysis */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={3}
              variants={fadeInUp}
            >
              <PitchAnalysisPanel />
            </motion.div>
          </div>

          {/* ═════════════ RIGHT COLUMN ═════════════ */}
          <motion.div
            className="lg:col-span-5 space-y-5"
            initial="hidden"
            animate="visible"
            variants={slideInRight}
          >
            {/* Lip Reading */}
            <Card delay={1}>
              <SectionHeader
                title="Lip Reading AI"
                subtitle="Real-time visual speech recognition"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              />
              <LipReadingPanel
                latestResult={lipReadingResult}
                history={lipReadingHistory}
                isAnalyzing={isLipAnalyzing}
                mouthState={mouthState}
              />
            </Card>

            {/* Tabbed Panel */}
            <Card noPad delay={2}>
              <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <TabButton
                    active={rightPanelTab === "controls"}
                    onClick={() => setRightPanelTab("controls")}
                    icon={
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                  >
                    Session
                  </TabButton>
                  <TabButton
                    active={rightPanelTab === "haptics"}
                    onClick={() => setRightPanelTab("haptics")}
                    icon={
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546" />
                      </svg>
                    }
                  >
                    Haptic Log
                  </TabButton>
                  <TabButton
                    active={rightPanelTab === "recording"}
                    onClick={() => setRightPanelTab("recording")}
                    icon={
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                      </svg>
                    }
                  >
                    Record
                  </TabButton>
                  <TabButton
                    active={rightPanelTab === "transcribe"}
                    onClick={() => setRightPanelTab("transcribe")}
                    icon={
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                  >
                    Transcribe
                  </TabButton>
                </div>
              </div>

              <AnimatePresence mode="wait">
              {/* ── Session Controls ─────────────────────────────── */}
              {rightPanelTab === "controls" && (
                <motion.div
                  key="controls"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 space-y-5"
                >
                  <SectionHeader
                    title="Session Controls"
                    icon={
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    }
                  />

                  {/* Lesson Selector */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select
                        value={selectedLesson}
                        onChange={(e) => setSelectedLesson(e.target.value)}
                        className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2.5 text-sm bg-white/[0.03] text-gray-200 focus:border-[#B87333]/40 focus:outline-none focus:ring-1 focus:ring-[#B87333]/20 transition-all font-mono"
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
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={loadLesson}
                        className="btn-copper px-5 py-2.5 rounded-lg text-sm"
                      >
                        Load
                      </motion.button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() =>
                          sendControl("start_playback", { start_time: 0 })
                        }
                        className="btn-success px-4 py-2.5 rounded-lg text-sm flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Start Lesson
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => sendControl("pause_playback")}
                        className="btn-warning px-4 py-2.5 rounded-lg text-sm flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                        Pause
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() =>
                          fetch(
                            `${
                              process.env.NEXT_PUBLIC_API_URL ||
                              "http://localhost:8000"
                            }/haptic/test`,
                            { method: "POST" }
                          ).catch(() => {})
                        }
                        className="btn-violet px-4 py-2.5 rounded-lg text-sm flex items-center gap-2"
                        title="Send test vibration to connected phones"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M12 12h.008v.008H12V12z" />
                        </svg>
                        Test Haptic
                      </motion.button>
                    </div>
                  </div>

                  <PhonemeTimeline
                    currentPhoneme={currentPhoneme}
                    mouthOpenness={mouthOpenness}
                  />

                  {/* Connection details */}
                  <div className="pt-4 border-t border-white/[0.04]">
                    <SectionHeader
                      title="Connection"
                      icon={
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                        </svg>
                      }
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {[
                        {
                          label: "Status",
                          value: status,
                          color: status === "connected" ? "text-emerald-400" : status === "error" ? "text-red-400" : "text-gray-400",
                        },
                        { label: "Landmarks", value: String(landmarkCount), color: "text-gray-300" },
                        { label: "Lip BBox", value: lipBoundingBox ? "Active" : "None", color: "text-gray-300" },
                        { label: "Mouth", value: mouthState, color: "text-gray-300" },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                          <span className="text-gray-500">{item.label}</span>
                          <span className={`font-semibold uppercase ${item.color}`}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Haptic Event Log ─────────────────────────────── */}
              {rightPanelTab === "haptics" && (
                <motion.div
                  key="haptics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="p-4"
                >
                  <SectionHeader
                    title="Haptic Feedback Log"
                    subtitle={`${hapticLog.length} events captured`}
                    icon={
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 010-5.304m5.304 0a3.75 3.75 0 010 5.304m-7.425 2.121a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M12 12h.008v.008H12V12z" />
                      </svg>
                    }
                    actions={
                      hapticLog.length > 0 ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setHapticLog([])}
                          className="text-[10px] text-gray-500 hover:text-[#D4A574] transition-colors px-2 py-1 rounded border border-transparent hover:border-white/[0.06]"
                        >
                          Clear
                        </motion.button>
                      ) : undefined
                    }
                  />
                  {hapticLog.length === 0 ? (
                    <div className="py-10 text-center">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center"
                      >
                        <svg
                          className="w-6 h-6 text-gray-600"
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
                      </motion.div>
                      <p className="text-xs text-gray-500">
                        No haptic events yet. Start a lesson to feel vibrations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                      {hapticLog
                        .slice()
                        .reverse()
                        .map((evt, i) => (
                          <HapticEventRow key={i} evt={evt} index={i} />
                        ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Record & Replay ──────────────────────────────── */}
              {rightPanelTab === "recording" && (
                <motion.div
                  key="recording"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="p-4"
                >
                  <SectionHeader
                    title="Record & Replay"
                    icon={
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                      </svg>
                    }
                  />
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
                </motion.div>
              )}

              {/* ── Transcribe ───────────────────────────────────── */}
              {rightPanelTab === "transcribe" && (
                <motion.div
                  key="transcribe"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="p-4"
                >
                  <SectionHeader
                    title="Transcribe"
                    icon={
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                  />
                  <TranscriptionPanel
                    isLive={status === "connected"}
                    onTranscript={(t) => setTranscript(t)}
                    onTranslation={(t, lang) => {
                      setTranslation(t);
                      setTargetLanguage(lang);
                    }}
                  />
                </motion.div>
              )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  );
}