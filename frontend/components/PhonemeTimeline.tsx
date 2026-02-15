"use client";

import React, { useState, useEffect } from 'react';

interface PhonemeTimelineProps {
  currentPhoneme: string | null;
  mouthOpenness: number;
  /** Optional: full phoneme list from a loaded lesson */
  phonemes?: Array<{
    id: string;
    type: string;
    character: string;
    word: string;
    start: number;
    duration: number;
  }>;
  /** Current playback time in the lesson (seconds) */
  currentTime?: number;
}

const PHONEME_COLORS: Record<string, string> = {
  vowel: 'bg-emerald-500',
  consonant: 'bg-[#B87333]',
  buzz: 'bg-amber-500',
  silence: 'bg-gray-600',
};

const PhonemeTimeline: React.FC<PhonemeTimelineProps> = ({
  currentPhoneme,
  mouthOpenness,
  phonemes = [],
  currentTime = 0,
}) => {
  const [recentPhonemes, setRecentPhonemes] = useState<
    Array<{ type: string; timestamp: number }>
  >([]);

  // Track recent phonemes for the rolling visualization
  useEffect(() => {
    if (currentPhoneme) {
      setRecentPhonemes(prev => [
        ...prev.slice(-29),
        { type: currentPhoneme, timestamp: Date.now() },
      ]);
    }
  }, [currentPhoneme]);

  // If we have a full lesson timeline, render the scrub bar
  if (phonemes.length > 0) {
    const totalDuration = phonemes.reduce(
      (max, p) => Math.max(max, p.start + p.duration),
      0,
    );

    return (
      <div className="space-y-3">
        {/* Timeline bar */}
        <div className="relative h-10 bg-black/30 rounded-lg overflow-hidden border border-white/10">
          {phonemes.map(p => {
            const left = (p.start / totalDuration) * 100;
            const width = (p.duration / totalDuration) * 100;
            const isActive =
              currentTime >= p.start && currentTime < p.start + p.duration;

            return (
              <div
                key={p.id}
                className={`absolute top-0 h-full flex items-center justify-center text-[10px] font-bold text-white border-r ${
                  PHONEME_COLORS[p.type] || 'bg-gray-600'
                } ${isActive ? 'ring-2 ring-[#D4A574] ring-inset opacity-100 shadow-[0_0_8px_rgba(184,115,51,0.5)]' : 'opacity-70'}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                title={`${p.character || p.type} – ${p.word}`}
              >
                {width > 3 ? p.character || p.type[0].toUpperCase() : ''}
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 h-full w-0.5 bg-[#D4A574] z-10 transition-all duration-100 shadow-[0_0_6px_rgba(212,165,116,0.6)]"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-gray-400">
          {Object.entries(PHONEME_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-sm ${color}`} />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback: rolling waveform from live detection
  return (
    <div className="space-y-3">
      {/* Live mouth-openness waveform */}
      <div className="relative h-16 bg-black/30 rounded-lg overflow-hidden border border-white/10 flex items-end">
        {recentPhonemes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            Phoneme activity will appear here during a lesson
          </div>
        ) : (
          recentPhonemes.map((p, i) => {
            const age = (Date.now() - p.timestamp) / 5000;
            const opacity = Math.max(1 - age, 0.2);
            const barHeight = 30 + Math.random() * 50;
            return (
              <div
                key={`${p.timestamp}-${i}`}
                className={`flex-1 transition-all duration-200 rounded-t-sm ${
                  PHONEME_COLORS[p.type] || 'bg-gray-600'
                }`}
                style={{
                  height: `${barHeight}%`,
                  opacity,
                  minWidth: 2,
                }}
              />
            );
          })
        )}
      </div>

      {/* Current phoneme badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentPhoneme ? (
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white ${
                PHONEME_COLORS[currentPhoneme] || 'bg-gray-600'
              } animate-pulse shadow-lg`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {currentPhoneme.toUpperCase()}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Idle</span>
          )}
        </div>

        {/* Mouth openness bar */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="text-gray-500">Mouth</span>
          <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#B87333] to-[#D4A574] rounded-full transition-all duration-75"
              style={{ width: `${Math.min(mouthOpenness * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhonemeTimeline;
