// this is index.ts — TypeScript type definitions: Phoneme, Lesson, HapticPattern, LipLandmark, SocketEvents

// ── Pitch Analysis Types ─────────────────────────────────────────────────────

export type { PitchFrame, PitchAnalysisConfig } from '@/lib/pitchAnalysis';

// ── Haptic Feedback Types ────────────────────────────────────────────────────

export type { HapticConfig, HapticState } from '@/lib/laryngealHaptics';

/** A single entry in the pitch history audiogram */
export interface PitchHistoryEntry {
  pitch: number;
  rms: number;
  voiced: boolean;
  timestamp: number;
}

/** Pitch classification ranges */
export type PitchRange = 'bass' | 'low-mid' | 'mid' | 'high-mid' | 'high';

/** Summary statistics for a pitch analysis session */
export interface PitchSessionStats {
  avgPitch: number;
  minPitch: number;
  maxPitch: number;
  voicedPercent: number;
  avgEnergy: number;
  pitchStability: number;
  duration: number;
}
