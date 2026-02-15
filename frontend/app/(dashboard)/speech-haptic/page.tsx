"use client";

import { useState, useEffect, useRef } from "react";
import { useSpeechHaptic } from "@/hooks/useSpeechHaptic";

export default function SpeechHapticPage() {
  const haptic = useSpeechHaptic({ autoConnect: false });
  const [showInfo, setShowInfo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [haptic.transcriptChunks]);

  // Fetch status on mount
  useEffect(() => {
    haptic.fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const intensityConfig: Record<
    string,
    { color: string; bg: string; border: string; label: string; glow: string }
  > = {
    silence: {
      color: "text-gray-500",
      bg: "bg-gray-800/40",
      border: "border-gray-700/40",
      label: "Silent",
      glow: "",
    },
    low: {
      color: "text-emerald-400",
      bg: "bg-emerald-900/30",
      border: "border-emerald-500/30",
      label: "Gentle",
      glow: "shadow-emerald-500/10",
    },
    medium: {
      color: "text-sky-400",
      bg: "bg-sky-900/30",
      border: "border-sky-500/30",
      label: "Normal",
      glow: "shadow-sky-500/15",
    },
    high: {
      color: "text-amber-400",
      bg: "bg-amber-900/30",
      border: "border-amber-500/30",
      label: "Strong",
      glow: "shadow-amber-500/20",
    },
    burst: {
      color: "text-rose-400",
      bg: "bg-rose-900/30",
      border: "border-rose-500/30",
      label: "Intense",
      glow: "shadow-rose-500/25",
    },
  };

  const currentCfg =
    intensityConfig[haptic.currentIntensity] || intensityConfig.silence;

  // Energy bar width (0-100%)
  const energyPct = Math.min(haptic.currentRms * 500, 100);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800/60">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400">
            Speech → Haptic
          </div>
          {haptic.isPipelineRunning && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1 rounded-lg border border-gray-800 transition-colors"
          >
            ℹ️
          </button>
          <div
            className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
              haptic.isConnected
                ? "bg-green-900/30 border-green-500/40 text-green-400"
                : "bg-red-900/30 border-red-500/40 text-red-400"
            }`}
          >
            {haptic.isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </header>

      {/* ── Info Banner ── */}
      {showInfo && (
        <div className="mx-4 mt-3 p-3 bg-indigo-950/50 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 leading-relaxed">
          <p className="font-semibold mb-1">How it works:</p>
          <p>
            Your laptop mic captures speech → ElevenLabs transcribes in real-time
            → transcript is split into natural phrases → each phrase triggers a
            haptic vibration on this phone. Louder speech = stronger vibrations.
          </p>
          <button
            onClick={() => setShowInfo(false)}
            className="mt-2 text-indigo-400 underline"
          >
            Got it
          </button>
        </div>
      )}

      {/* ── Connection + Pipeline Controls ── */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        {/* Connect/Disconnect */}
        <div className="flex gap-2">
          {!haptic.isConnected ? (
            <button
              onClick={haptic.connect}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-purple-500/20"
            >
              🔌 Connect
            </button>
          ) : (
            <button
              onClick={haptic.disconnect}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium text-sm transition-all border border-gray-700"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Start/Stop Pipeline */}
        {haptic.isConnected && (
          <div className="flex gap-2">
            {!haptic.isPipelineRunning ? (
              <button
                onClick={async () => {
                  await haptic.startPipeline();
                  // Trigger a tiny vibration on user gesture so the browser
                  // unlocks the Vibration API for future calls
                  if (navigator.vibrate) navigator.vibrate(1);
                }}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-green-500/20"
              >
                🎙️ Start Listening
              </button>
            ) : (
              <button
                onClick={haptic.stopPipeline}
                className="flex-1 bg-gradient-to-r from-red-700 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-red-500/20"
              >
                ⏹ Stop
              </button>
            )}
            <button
              onClick={haptic.clearTranscript}
              className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 py-3 rounded-xl text-sm transition-all border border-gray-700"
              title="Clear transcript"
            >
              🗑
            </button>
          </div>
        )}
      </div>

      {/* ── Energy Visualizer ── */}
      {haptic.isConnected && haptic.isPipelineRunning && (
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Voice Energy
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${currentCfg.color}`}
              >
                {currentCfg.label}
              </span>
              <span className="text-[10px] text-gray-600 font-mono">
                {(haptic.currentRms * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-3 bg-gray-800/60 rounded-full overflow-hidden border border-gray-700/30">
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${energyPct}%`,
                background:
                  energyPct > 60
                    ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                    : energyPct > 30
                    ? "linear-gradient(90deg, #06b6d4, #8b5cf6)"
                    : "linear-gradient(90deg, #10b981, #06b6d4)",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Transcript Stream ── */}
      <div className="flex-1 px-4 py-2 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Live Transcript
          </span>
          {haptic.chunksReceived > 0 && (
            <span className="text-[10px] text-gray-600 font-mono">
              {haptic.chunksReceived} chunks
            </span>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-700 pr-1"
        >
          {haptic.transcriptChunks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="text-4xl">
                  {haptic.isPipelineRunning ? "👂" : "🎙️"}
                </div>
                <p className="text-gray-500 text-sm">
                  {!haptic.isConnected
                    ? "Connect to the server to begin"
                    : !haptic.isPipelineRunning
                    ? 'Tap "Start Listening" to begin'
                    : "Listening for speech..."}
                </p>
                {haptic.isPipelineRunning && (
                  <div className="flex justify-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            haptic.transcriptChunks.map((chunk, i) => {
              const cfg =
                intensityConfig[chunk.intensity] || intensityConfig.silence;
              return (
                <div
                  key={`${chunk.chunkIndex}-${i}`}
                  className={`px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border} ${cfg.glow} shadow-lg transition-all animate-in slide-in-from-bottom-2 duration-300`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-white/90 leading-relaxed flex-1">
                      {chunk.text}
                    </p>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Full Transcript (collapsed view) ── */}
      {haptic.fullTranscript && (
        <div className="px-4 py-2 border-t border-gray-800/60">
          <details className="group">
            <summary className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold cursor-pointer select-none hover:text-gray-400 transition-colors">
              Full Transcript ▾
            </summary>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed max-h-24 overflow-y-auto">
              {haptic.fullTranscript}
            </p>
          </details>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-gray-600 font-mono">
          <span>📳 {haptic.chunksReceived} pulses</span>
          {!haptic.vibrationSupported && (
            <span className="text-amber-500">⚠ No Vibration API</span>
          )}
        </div>
        <div className="text-[10px] text-gray-700 font-mono">
          HapticPhonix • Speech Pipeline
        </div>
      </div>
    </div>
  );
}
