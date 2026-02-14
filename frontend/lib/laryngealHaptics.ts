/**
 * Laryngeal Vibration Engine
 * 
 * Simulates human throat (larynx) vibration using the Web Vibration API.
 * Dynamically maps pitch (Hz) and intensity (RMS) to vibration patterns
 * that approximate the tactile sensation of voiced speech.
 * 
 * Design principles:
 *  - Low pitch  → slower, "deeper" pulses (longer on, longer off)
 *  - High pitch → faster, "tighter" pulses (shorter on, shorter off)
 *  - Loud sound → longer vibration bursts (more energy)
 *  - Soft sound → shorter bursts (less energy)
 *  - Voiced     → vibrating
 *  - Unvoiced   → silent motor
 * 
 * The Web Vibration API only accepts pattern arrays [on, off, on, off, ...].
 * We simulate "frequency" by adjusting the on/off cycle timing.
 * 
 * Architecture:
 *  - Exponential smoothing on pitch + RMS to prevent jitter
 *  - Pattern scheduler with throttled updates (~15–20 Hz max motor refresh)
 *  - Automatic cancellation on unvoiced segments
 *  - Battery-aware: pauses motor when page is not visible
 */

import type { PitchFrame } from './pitchAnalysis';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HapticConfig {
  /** Minimum voice pitch to map (Hz). Default 80 */
  minPitch?: number;
  /** Maximum voice pitch to map (Hz). Default 400 */
  maxPitch?: number;
  /** Minimum vibration cycle period in ms (fastest buzz). Default 15 */
  minCycleMs?: number;
  /** Maximum vibration cycle period in ms (slowest buzz). Default 80 */
  maxCycleMs?: number;
  /** Minimum on-duration per pulse in ms. Default 8 */
  minOnMs?: number;
  /** Maximum on-duration per pulse in ms. Default 60 */
  maxOnMs?: number;
  /** Number of pulses per pattern batch. Default 4 */
  pulsesPerBatch?: number;
  /** Minimum ms between motor updates (throttle). Default 50 */
  updateIntervalMs?: number;
  /** Exponential smoothing factor (0–1). Higher = more responsive. Default 0.35 */
  smoothingAlpha?: number;
  /** RMS threshold below which vibration stops. Default 0.015 */
  silenceThreshold?: number;
  /** Whether haptics are enabled. Default true */
  enabled?: boolean;
}

export interface HapticState {
  /** Whether the motor is currently vibrating */
  isVibrating: boolean;
  /** Current smoothed pitch being mapped */
  smoothedPitch: number;
  /** Current smoothed RMS */
  smoothedRms: number;
  /** The active vibration pattern [on, off, ...] */
  currentPattern: number[];
  /** Vibration cycle period in ms */
  cyclePeriodMs: number;
  /** On-duration per pulse in ms */
  onDurationMs: number;
  /** Total pattern duration in ms */
  patternDurationMs: number;
  /** Descriptive label for the current haptic feel */
  feelLabel: string;
  /** Number of pattern updates per second */
  updatesPerSecond: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<HapticConfig> = {
  minPitch: 80,
  maxPitch: 400,
  minCycleMs: 15,
  maxCycleMs: 80,
  minOnMs: 8,
  maxOnMs: 60,
  pulsesPerBatch: 4,
  updateIntervalMs: 50,
  smoothingAlpha: 0.35,
  silenceThreshold: 0.015,
  enabled: true,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a value from one range to another */
function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}

/** Describe the haptic feel based on pitch and intensity */
function describeFeel(pitch: number, rms: number): string {
  if (pitch === 0 || rms < 0.01) return 'Silent';

  const pitchDesc = pitch < 150 ? 'Deep' : pitch < 250 ? 'Medium' : 'Light';
  const intensityDesc = rms < 0.05 ? 'gentle' : rms < 0.15 ? 'moderate' : 'strong';

  return `${pitchDesc} ${intensityDesc} buzz`;
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class LaryngealHapticEngine {
  private config: Required<HapticConfig>;
  
  // Smoothed values (exponential moving average)
  private smoothedPitch = 0;
  private smoothedRms = 0;
  
  // Scheduling
  private lastUpdateTime = 0;
  private isVibrating = false;
  private updateCount = 0;
  private updateCountResetTime = 0;
  private updatesPerSecond = 0;
  
  // Current pattern state
  private currentPattern: number[] = [];
  private cyclePeriodMs = 0;
  private onDurationMs = 0;
  
  // Visibility handling
  private visibilityHandler: (() => void) | null = null;
  private isPageVisible = true;

  /** Callback for state changes (for UI) */
  public onStateChange: ((state: HapticState) => void) | null = null;

  constructor(config: HapticConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupVisibilityHandler();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Feed a pitch frame into the engine. Call this every analysis frame (~60fps).
   * The engine will internally throttle motor updates to a safe refresh rate.
   */
  feed(frame: PitchFrame): void {
    if (!this.config.enabled) return;
    if (!this.isPageVisible) return;

    const now = performance.now();
    const alpha = this.config.smoothingAlpha;

    // ── Exponential smoothing ────────────────────────────────────────
    if (frame.voiced && frame.pitch > 0) {
      // Smooth pitch — only update when voiced to avoid dragging toward 0
      this.smoothedPitch = this.smoothedPitch === 0
        ? frame.pitch
        : this.smoothedPitch * (1 - alpha) + frame.pitch * alpha;

      // Smooth RMS
      this.smoothedRms = this.smoothedRms * (1 - alpha) + frame.rms * alpha;
    } else {
      // Decay RMS quickly when unvoiced
      this.smoothedRms *= 0.7;

      // If RMS drops below threshold, kill vibration
      if (this.smoothedRms < this.config.silenceThreshold) {
        this.stopVibration();
        return;
      }
    }

    // ── Throttle motor updates ───────────────────────────────────────
    const elapsed = now - this.lastUpdateTime;
    if (elapsed < this.config.updateIntervalMs) return;
    this.lastUpdateTime = now;

    // Track update rate
    this.updateCount++;
    if (now - this.updateCountResetTime > 1000) {
      this.updatesPerSecond = this.updateCount;
      this.updateCount = 0;
      this.updateCountResetTime = now;
    }

    // ── Decide: vibrate or stop ──────────────────────────────────────
    if (!frame.voiced || frame.rms < this.config.silenceThreshold) {
      this.stopVibration();
      return;
    }

    // ── Compute vibration parameters ─────────────────────────────────
    this.computeAndVibrate();
  }

  /** Stop all vibration immediately */
  stop(): void {
    this.stopVibration();
    this.smoothedPitch = 0;
    this.smoothedRms = 0;
  }

  /** Update config at runtime */
  updateConfig(patch: Partial<HapticConfig>): void {
    Object.assign(this.config, patch);
  }

  /** Get current state snapshot */
  getState(): HapticState {
    return {
      isVibrating: this.isVibrating,
      smoothedPitch: this.smoothedPitch,
      smoothedRms: this.smoothedRms,
      currentPattern: [...this.currentPattern],
      cyclePeriodMs: this.cyclePeriodMs,
      onDurationMs: this.onDurationMs,
      patternDurationMs: this.currentPattern.reduce((a, b) => a + b, 0),
      feelLabel: describeFeel(this.smoothedPitch, this.smoothedRms),
      updatesPerSecond: this.updatesPerSecond,
    };
  }

  /** Clean up event listeners */
  destroy(): void {
    this.stop();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /** Check if vibration API is available */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  // ── Private ────────────────────────────────────────────────────────────

  /**
   * Core mapping: convert smoothed pitch + RMS into a vibration pattern.
   * 
   * PITCH → CYCLE PERIOD
   *   Low pitch (80 Hz)  → long cycles (80ms = slow buzz)
   *   High pitch (400 Hz) → short cycles (15ms = fast buzz)
   *   Mapping is inverse-linear: higher pitch → shorter period
   * 
   * RMS → ON-DURATION (duty cycle)
   *   Low energy  → short on-time (8ms = light tap)
   *   High energy → long on-time (60ms = strong buzz)
   *   The duty cycle determines perceived "strength"
   * 
   * Pattern = [on, off, on, off, ...] repeated `pulsesPerBatch` times
   */
  private computeAndVibrate(): void {
    const { minPitch, maxPitch, minCycleMs, maxCycleMs, minOnMs, maxOnMs, pulsesPerBatch } = this.config;

    // ── Map pitch to cycle period (inverse: high pitch → short period) ──
    this.cyclePeriodMs = Math.round(
      mapRange(this.smoothedPitch, minPitch, maxPitch, maxCycleMs, minCycleMs),
    );

    // ── Map RMS to on-duration (proportional: louder → longer on) ──
    // Also scale by pitch — higher pitch gets slightly shorter pulses for realism
    const pitchFactor = mapRange(this.smoothedPitch, minPitch, maxPitch, 1.0, 0.7);
    const baseOn = mapRange(this.smoothedRms, 0, 0.3, minOnMs, maxOnMs);
    this.onDurationMs = Math.round(clamp(baseOn * pitchFactor, minOnMs, maxOnMs));

    // ── Off-duration = remainder of cycle ──
    const offDurationMs = Math.max(1, this.cyclePeriodMs - this.onDurationMs);

    // ── Build pattern ──
    const pattern: number[] = [];
    for (let i = 0; i < pulsesPerBatch; i++) {
      pattern.push(this.onDurationMs);
      if (i < pulsesPerBatch - 1) {
        pattern.push(offDurationMs);
      }
    }

    this.currentPattern = pattern;
    this.isVibrating = true;

    // ── Fire vibration ──
    if (LaryngealHapticEngine.isSupported()) {
      // Cancel previous pattern before starting new one
      navigator.vibrate(0);
      navigator.vibrate(pattern);
    }

    // Notify UI
    this.onStateChange?.(this.getState());
  }

  private stopVibration(): void {
    if (this.isVibrating) {
      this.isVibrating = false;
      this.currentPattern = [];
      this.cyclePeriodMs = 0;
      this.onDurationMs = 0;

      if (LaryngealHapticEngine.isSupported()) {
        navigator.vibrate(0); // Cancel immediately
      }

      this.onStateChange?.(this.getState());
    }
  }

  /** Pause vibration when tab is not visible (battery saving) */
  private setupVisibilityHandler(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      this.isPageVisible = !document.hidden;
      if (!this.isPageVisible) {
        this.stopVibration();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }
}

// ── Presets for different speech sounds ──────────────────────────────────────

/**
 * Generate a test pattern that simulates a specific speech sound.
 * Useful for demonstrations and testing.
 */
export function generateTestPattern(
  sound: 'v' | 'm' | 'z' | 'ah' | 'ee' | 'rising' | 'falling',
): number[] {
  switch (sound) {
    case 'v':
      // Voiced fricative — medium-fast buzz, moderate intensity
      // Like pressing lips to back of hand while saying "vvvv"
      return [25, 15, 25, 15, 25, 15, 25, 15, 25, 15, 25, 15, 25];

    case 'm':
      // Nasal — slow, steady hum, strong buzz
      // Like the vibration you feel touching your nose while humming
      return [50, 20, 50, 20, 50, 20, 50, 20, 50];

    case 'z':
      // Voiced sibilant — fast buzzy texture
      return [15, 10, 15, 10, 15, 10, 15, 10, 15, 10, 15, 10, 15, 10, 15];

    case 'ah':
      // Open vowel — deep, strong, sustained
      return [60, 30, 60, 30, 60, 30, 60];

    case 'ee':
      // High vowel — lighter, faster
      return [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20];

    case 'rising':
      // Rising pitch — cycles get progressively shorter
      return [60, 40, 50, 35, 40, 30, 30, 25, 20, 15, 15, 10, 12, 8, 10, 6, 8];

    case 'falling':
      // Falling pitch — cycles get progressively longer
      return [10, 6, 12, 8, 15, 10, 20, 15, 30, 20, 40, 30, 50, 35, 60];

    default:
      return [30, 20, 30, 20, 30];
  }
}

/**
 * Get a human-readable description of what a test sound feels like.
 */
export function getTestSoundDescription(
  sound: 'v' | 'm' | 'z' | 'ah' | 'ee' | 'rising' | 'falling',
): string {
  switch (sound) {
    case 'v': return 'Buzzing lips — like saying "vvvv" with hand on throat';
    case 'm': return 'Deep hum — like humming "mmmm" with hand on nose';
    case 'z': return 'Fast buzz — like a bee, saying "zzzz"';
    case 'ah': return 'Open throat — deep "ahhh" with strong vibration';
    case 'ee': return 'High & light — saying "eee" with gentle buzz';
    case 'rising': return 'Rising pitch — voice going from low to high';
    case 'falling': return 'Falling pitch — voice going from high to low';
    default: return '';
  }
}
