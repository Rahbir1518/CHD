/**
 * Snowflake AI Coaching Panel
 *
 * Displays personalized coaching feedback from Snowflake Cortex
 * after a practice session. Themed to match HapticPhonix dark copper UI.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface CoachingFeedback {
  success: boolean;
  encouragement: string;
  focus_areas: string[];
  next_steps: string[];
  model: string;
  provider: string;
}

interface PhonemeTip {
  phoneme: string;
  tip: string;
  placement?: string;
  common_error?: string;
  ai_tip?: string;
}

interface CoachingStatus {
  enabled: boolean;
  mode: string;
  available_models: string[];
  sessions_tracked: number;
}

interface SessionData {
  phonemes: string[];
  scores: Record<string, number>;
  struggles: string[];
  duration?: number;
  model?: string;
}

interface SnowflakeCoachingProps {
  /** Pre-populated session data from the active practice session */
  sessionData?: SessionData;
  /** Currently detected phoneme (for quick tips) */
  currentPhoneme?: string | null;
  /** Haptic events count for building session context */
  hapticEventCount?: number;
  /** Whether a session is currently active */
  isSessionActive?: boolean;
}

/* ─── API Helper ─────────────────────────────────────────────────────────── */

const API_BASE =
  typeof window !== "undefined"
    ? `http://${window.location.hostname}:8000`
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function SnowflakeCoaching({
  sessionData,
  currentPhoneme,
  hapticEventCount = 0,
  isSessionActive = false,
}: SnowflakeCoachingProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<CoachingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coachStatus, setCoachStatus] = useState<CoachingStatus | null>(null);
  const [phonemeTip, setPhonemeTip] = useState<PhonemeTip | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("mistral-large");

  // Fetch coaching engine status on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/coaching/status`)
      .then((r) => r.json())
      .then(setCoachStatus)
      .catch(() => {});
  }, []);

  // Auto-fetch phoneme tip when a phoneme is detected
  useEffect(() => {
    if (!currentPhoneme) {
      setPhonemeTip(null);
      return;
    }
    let cancelled = false;
    setTipLoading(true);
    fetch(`${API_BASE}/api/phoneme-tip/${currentPhoneme}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setPhonemeTip(data);
          setTipLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setTipLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentPhoneme]);

  // Request coaching feedback
  const getCoachingFeedback = useCallback(
    async (data: SessionData) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/coaching-feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, model: selectedModel }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const result: CoachingFeedback = await response.json();
        setFeedback(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get coaching feedback");
      } finally {
        setLoading(false);
      }
    },
    [selectedModel]
  );

  // Build session data from props or use defaults for demo
  const handleGetFeedback = () => {
    const data: SessionData = sessionData || {
      phonemes: ["AH", "EE", "S"],
      scores: { AH: 0.85, EE: 0.62, S: 0.9 },
      struggles: ["inconsistent pitch on EE", "weak vibration"],
      duration: 300,
    };
    getCoachingFeedback(data);
  };

  /* ─── Status badge ─────────────────────────────────────────────────── */
  const statusBadge = coachStatus ? (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          coachStatus.mode === "connector" || coachStatus.mode === "rest"
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
            : coachStatus.mode === "mock"
            ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
            : "bg-red-400"
        }`}
      />
      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
        {coachStatus.mode === "connector"
          ? "Cortex Live"
          : coachStatus.mode === "rest"
          ? "REST API"
          : coachStatus.mode === "mock"
          ? "Demo Mode"
          : "Offline"}
      </span>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#B87333]/15 border border-[#B87333]/20 flex items-center justify-center">
            <svg
              className="w-3.5 h-3.5 text-[#D4A574]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-gray-200 tracking-tight">
              AI Coach
            </h3>
            <p className="text-[10px] text-gray-500">Snowflake Cortex</p>
          </div>
        </div>
        {statusBadge}
      </div>

      {/* ── Model Selector ── */}
      {coachStatus?.available_models && coachStatus.available_models.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Model
          </span>
          <div className="flex gap-1 flex-1">
            {coachStatus.available_models.map((model) => (
              <button
                key={model}
                onClick={() => setSelectedModel(model)}
                className={`text-[10px] px-2.5 py-1 rounded-md font-mono transition-all ${
                  selectedModel === model
                    ? "bg-[#B87333]/15 text-[#D4A574] border border-[#B87333]/30"
                    : "text-gray-500 border border-white/[0.04] hover:border-white/[0.08] hover:text-gray-400"
                }`}
              >
                {model.split("-")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Phoneme Tip ── */}
      <AnimatePresence mode="wait">
        {currentPhoneme && (
          <motion.div
            key={currentPhoneme}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-[#B87333]/20 bg-[#B87333]/[0.06] p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold text-[#D4A574] bg-[#B87333]/20 px-2 py-0.5 rounded-md">
                {currentPhoneme}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#D4A574]/60 font-semibold">
                Quick Tip
              </span>
            </div>
            {tipLoading ? (
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                    className="w-1 h-1 rounded-full bg-[#D4A574]"
                  />
                ))}
              </div>
            ) : phonemeTip ? (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-300 leading-relaxed">
                  {phonemeTip.tip}
                </p>
                {phonemeTip.placement && (
                  <p className="text-[10px] text-gray-500">
                    <span className="text-[#D4A574]/70 font-semibold">Placement:</span>{" "}
                    {phonemeTip.placement}
                  </p>
                )}
                {phonemeTip.ai_tip && (
                  <p className="text-[10px] text-gray-400 italic border-t border-white/[0.04] pt-1.5 mt-1.5">
                    <span className="text-[#D4A574]/50">AI:</span> {phonemeTip.ai_tip}
                  </p>
                )}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Get Feedback Button ── */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleGetFeedback}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-display font-semibold text-sm transition-all ${
          loading
            ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/[0.04]"
            : "bg-gradient-to-r from-[#B87333] to-[#D4A574] text-white shadow-lg shadow-[#B87333]/20 hover:shadow-[#B87333]/30 active:scale-[0.98]"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block w-4 h-4 border-2 border-gray-600 border-t-[#D4A574] rounded-full"
            />
            Analyzing with {selectedModel}…
          </span>
        ) : feedback ? (
          "Get Updated Coaching"
        ) : (
          <>
            <span className="mr-1.5">✦</span> Get AI Coaching Feedback
          </>
        )}
      </motion.button>

      {/* ── Session Context (when active) ── */}
      {isSessionActive && hapticEventCount > 0 && !feedback && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{hapticEventCount} haptic events captured this session</span>
        </div>
      )}

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-xs text-red-300 font-medium">
                  Coaching unavailable
                </p>
                <p className="text-[10px] text-red-400/70 mt-0.5">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Feedback Display ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            {/* Encouragement */}
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">
                  Great Work
                </span>
              </div>
              <p className="text-sm text-emerald-200/90 leading-relaxed">
                {feedback.encouragement}
              </p>
            </motion.div>

            {/* Focus Areas */}
            {feedback.focus_areas?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-5 h-5 rounded-md bg-amber-500/15 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-amber-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">
                    Focus Areas
                  </span>
                </div>
                <ul className="space-y-2">
                  {feedback.focus_areas.map((area, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + idx * 0.08 }}
                      className="flex items-start gap-2"
                    >
                      <div className="w-1 h-1 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
                      <span className="text-xs text-amber-200/70 leading-relaxed">
                        {area}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Next Steps */}
            {feedback.next_steps?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-5 h-5 rounded-md bg-sky-500/15 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-sky-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold text-sky-400/80 uppercase tracking-wider">
                    Next Practice
                  </span>
                </div>
                {feedback.next_steps.map((step, idx) => (
                  <p
                    key={idx}
                    className="text-xs text-sky-200/70 leading-relaxed"
                  >
                    {step}
                  </p>
                ))}
              </motion.div>
            )}

            {/* Meta */}
            <div className="flex items-center justify-between text-[10px] text-gray-600 font-mono pt-1 border-t border-white/[0.04]">
              <span>
                {feedback.model} · {feedback.provider}
              </span>
              {coachStatus && coachStatus.sessions_tracked > 0 && (
                <span>{coachStatus.sessions_tracked} sessions tracked</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty State ── */}
      {!feedback && !loading && !error && !currentPhoneme && (
        <div className="py-6 text-center">
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center"
          >
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
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </motion.div>
          <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
            {isSessionActive
              ? "Practice some phonemes, then get personalized AI coaching feedback."
              : "Start a session and practice to unlock AI coaching insights."}
          </p>
        </div>
      )}
    </div>
  );
}
