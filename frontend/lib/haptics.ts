// Haptics — re-exports from the laryngeal haptics engine
// The original phoneme-based patterns are kept for backward compatibility.
// The new pitch-driven laryngeal system is the primary haptic engine.

export {
  LaryngealHapticEngine,
  generateTestPattern,
  getTestSoundDescription,
  type HapticConfig,
  type HapticState,
} from './laryngealHaptics';

// ── Legacy phoneme-based patterns (from backend haptic_patterns.py) ──────────

export const PHONEME_PATTERNS: Record<string, number[]> = {
  vowel:     [100, 50, 100],
  consonant: [200, 100, 200],
  buzz:      [50, 30, 50, 30, 50],
  silence:   [],
};
