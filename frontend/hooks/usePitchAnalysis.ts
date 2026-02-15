import { useState, useEffect, useRef, useCallback } from 'react';
import { PitchAnalyzer, type PitchFrame, type PitchAnalysisConfig } from '@/lib/pitchAnalysis';

export interface UsePitchAnalysisReturn {
  /** Whether mic is active and analyzing */
  isActive: boolean;
  /** Whether we're in the process of starting */
  isStarting: boolean;
  /** Latest analysis frame */
  currentFrame: PitchFrame | null;
  /** Rolling history of frames (~10s) */
  history: PitchFrame[];
  /** Any error message */
  error: string | null;
  /** Start microphone & analysis */
  start: () => Promise<void>;
  /** Stop analysis & release mic */
  stop: () => void;
  /** Toggle start/stop */
  toggle: () => Promise<void>;
  /** Clear history */
  clearHistory: () => void;
}

/**
 * React hook wrapping PitchAnalyzer for real-time pitch analysis.
 * 
 * Usage:
 * ```tsx
 * const { isActive, currentFrame, history, start, stop } = usePitchAnalysis();
 * ```
 */
export function usePitchAnalysis(config?: PitchAnalysisConfig): UsePitchAnalysisReturn {
  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<PitchFrame | null>(null);
  const [history, setHistory] = useState<PitchFrame[]>([]);
  const [error, setError] = useState<string | null>(null);

  const analyzerRef = useRef<PitchAnalyzer | null>(null);
  const frameCountRef = useRef(0);

  // Create analyzer instance (once)
  useEffect(() => {
    analyzerRef.current = new PitchAnalyzer(config);

    return () => {
      analyzerRef.current?.stop();
      analyzerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (!analyzerRef.current || isActive || isStarting) return;

    setIsStarting(true);
    setError(null);

    const analyzer = analyzerRef.current;

    // Set up frame callback — throttle React state updates to ~30fps
    // to avoid re-render overhead while still analyzing at full speed
    analyzer.onFrame = (frame: PitchFrame) => {
      frameCountRef.current++;
      // Update state every 2nd frame (~30fps React updates)
      if (frameCountRef.current % 2 === 0) {
        setCurrentFrame(frame);
        setHistory([...analyzer.history]);
      }
    };

    analyzer.onError = (msg: string) => {
      setError(msg);
      setIsActive(false);
      setIsStarting(false);
    };

    try {
      await analyzer.start();
      setIsActive(true);
    } catch {
      setError('Failed to start pitch analysis. Check microphone permissions.');
    } finally {
      setIsStarting(false);
    }
  }, [isActive, isStarting]);

  const stop = useCallback(() => {
    analyzerRef.current?.stop();
    setIsActive(false);
    setCurrentFrame(null);
  }, []);

  const toggle = useCallback(async () => {
    if (isActive) {
      stop();
    } else {
      await start();
    }
  }, [isActive, start, stop]);

  const clearHistory = useCallback(() => {
    if (analyzerRef.current) {
      analyzerRef.current.history = [];
    }
    setHistory([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      analyzerRef.current?.stop();
    };
  }, []);

  return {
    isActive,
    isStarting,
    currentFrame,
    history,
    error,
    start,
    stop,
    toggle,
    clearHistory,
  };
}
