import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LaryngealHapticEngine,
  type HapticConfig,
  type HapticState,
  generateTestPattern,
} from '@/lib/laryngealHaptics';
import type { PitchFrame } from '@/lib/pitchAnalysis';

export interface UseLaryngealHapticsReturn {
  /** Whether haptics are enabled */
  enabled: boolean;
  /** Toggle haptics on/off */
  setEnabled: (enabled: boolean) => void;
  /** Current haptic state (vibrating, pattern, smoothed values) */
  state: HapticState;
  /** Feed a pitch frame to drive haptics */
  feed: (frame: PitchFrame) => void;
  /** Stop all vibration */
  stop: () => void;
  /** Play a test sound vibration pattern */
  playTest: (sound: 'v' | 'm' | 'z' | 'ah' | 'ee' | 'rising' | 'falling') => void;
  /** Whether vibration API is supported */
  isSupported: boolean;
  /** Update engine config at runtime */
  updateConfig: (patch: Partial<HapticConfig>) => void;
}

const EMPTY_STATE: HapticState = {
  isVibrating: false,
  smoothedPitch: 0,
  smoothedRms: 0,
  currentPattern: [],
  cyclePeriodMs: 0,
  onDurationMs: 0,
  patternDurationMs: 0,
  feelLabel: 'Silent',
  updatesPerSecond: 0,
};

/**
 * React hook for the laryngeal haptic feedback engine.
 * 
 * Feed it PitchFrame objects from usePitchAnalysis and it will
 * dynamically vibrate the device motor to simulate throat vibration.
 * 
 * Usage:
 * ```tsx
 * const haptics = useLaryngealHaptics();
 * // In your pitch analysis callback:
 * haptics.feed(pitchFrame);
 * ```
 */
export function useLaryngealHaptics(config?: HapticConfig): UseLaryngealHapticsReturn {
  const [enabled, setEnabledState] = useState(config?.enabled ?? true);
  const [state, setState] = useState<HapticState>(EMPTY_STATE);
  const [isSupported] = useState(() => LaryngealHapticEngine.isSupported());

  const engineRef = useRef<LaryngealHapticEngine | null>(null);

  // Create engine
  useEffect(() => {
    const engine = new LaryngealHapticEngine({ ...config, enabled });
    engine.onStateChange = (newState) => {
      setState(newState);
    };
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync enabled state
  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
    engineRef.current?.updateConfig({ enabled: val });
    if (!val) {
      engineRef.current?.stop();
      setState(EMPTY_STATE);
    }
  }, []);

  const feed = useCallback((frame: PitchFrame) => {
    engineRef.current?.feed(frame);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setState(EMPTY_STATE);
  }, []);

  const playTest = useCallback((sound: 'v' | 'm' | 'z' | 'ah' | 'ee' | 'rising' | 'falling') => {
    if (!isSupported) return;
    const pattern = generateTestPattern(sound);
    navigator.vibrate(0);
    navigator.vibrate(pattern);
  }, [isSupported]);

  const updateConfig = useCallback((patch: Partial<HapticConfig>) => {
    engineRef.current?.updateConfig(patch);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  return {
    enabled,
    setEnabled,
    state,
    feed,
    stop,
    playTest,
    isSupported,
    updateConfig,
  };
}
