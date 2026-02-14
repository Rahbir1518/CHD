"use client";

import React from "react";

interface LipReadingEntry {
  detected_text: string;
  confidence: number;
  mouth_state: string;
  phonemes_detected: string[];
  analysis_notes: string;
  timestamp: number;
}

interface LipReadingPanelProps {
  /** Latest lip reading result */
  latestResult: LipReadingEntry | null;
  /** History of lip reading results */
  history: LipReadingEntry[];
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Current mouth state from movement tracking */
  mouthState: string;
}

const MOUTH_STATE_CONFIG: Record<string, { icon: string; color: string; label: string; bgClass: string }> = {
  closed: { icon: "😶", color: "text-gray-400", label: "Closed", bgClass: "bg-gray-700" },
  open:   { icon: "😮", color: "text-yellow-400", label: "Open", bgClass: "bg-yellow-900/30" },
  talking: { icon: "🗣️", color: "text-green-400", label: "Talking", bgClass: "bg-green-900/30" },
  unknown: { icon: "❓", color: "text-gray-500", label: "Unknown", bgClass: "bg-gray-800" },
};

export default function LipReadingPanel({
  latestResult,
  history,
  isAnalyzing,
  mouthState,
}: LipReadingPanelProps) {
  const stateConfig = MOUTH_STATE_CONFIG[mouthState] || MOUTH_STATE_CONFIG.unknown;

  return (
    <div className="space-y-4">
      {/* Mouth State Indicator */}
      <div className={`flex items-center justify-between p-3 rounded-lg border border-gray-700 ${stateConfig.bgClass} transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{stateConfig.icon}</span>
          <div>
            <div className={`text-sm font-semibold ${stateConfig.color}`}>
              {stateConfig.label}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">
              Mouth State
            </div>
          </div>
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-blue-400">Analyzing...</span>
          </div>
        )}
      </div>

      {/* Latest Detection */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <span className="text-base">👄</span>
          Lip Reading Detection
        </h3>

        {latestResult && latestResult.detected_text ? (
          <div className="space-y-3">
            {/* Detected Text */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="text-white text-base font-medium leading-relaxed">
                &ldquo;{latestResult.detected_text}&rdquo;
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                    style={{ width: "60px" }}
                  />
                  <span className="text-xs text-gray-400 font-mono ml-1">
                    {(latestResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Phonemes */}
            {latestResult.phonemes_detected.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Detected Phonemes
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {latestResult.phonemes_detected.map((p, i) => (
                    <span
                      key={i}
                      className="bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono border border-indigo-800/50"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Notes */}
            {latestResult.analysis_notes && (
              <div className="text-xs text-gray-500 italic">
                {latestResult.analysis_notes}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-gray-600 text-sm">
              {isAnalyzing
                ? "Analyzing lip movements..."
                : "Waiting for lip movement detection. Speak in front of the camera."}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Detection History
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {history
              .slice()
              .reverse()
              .map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="bg-gray-800/50 rounded-lg p-2 text-xs flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white truncate">
                      &ldquo;{entry.detected_text}&rdquo;
                    </div>
                    {entry.phonemes_detected.length > 0 && (
                      <div className="text-gray-500 truncate mt-0.5">
                        {entry.phonemes_detected.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-gray-500 font-mono">
                      {(entry.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-gray-600">
                      {new Date(entry.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
