/**
 * Real-time Pitch Analysis Engine
 * 
 * Uses Web Audio API + YIN autocorrelation for fundamental frequency detection.
 * Designed for voice analysis with <100ms latency on Android Chrome.
 * 
 * Computes:
 *  - Fundamental frequency (pitch in Hz)
 *  - RMS energy (intensity 0-1)
 *  - Voiced vs unvoiced classification
 *  - Pitch stability (variance over sliding window)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PitchFrame {
  /** Fundamental frequency in Hz, or 0 if unvoiced */
  pitch: number;
  /** RMS energy / intensity (0 = silence, 1 = max) */
  rms: number;
  /** Confidence of pitch detection (0–1) */
  confidence: number;
  /** true when the signal contains periodic voiced speech */
  voiced: boolean;
  /** Pitch stability — lower = more stable (std-dev over recent window in Hz) */
  pitchStability: number;
  /** MIDI note number (A4 = 69) for the detected pitch, or null */
  midiNote: number | null;
  /** Musical note name, e.g. "A4", "C#3" */
  noteName: string | null;
  /** Timestamp (performance.now()) */
  timestamp: number;
}

export interface PitchAnalysisConfig {
  /** FFT size — must be power of 2. Default 2048 (≈43ms @ 48kHz) */
  fftSize?: number;
  /** Minimum detectable frequency (Hz). Default 50 (low male voice) */
  minFrequency?: number;
  /** Maximum detectable frequency (Hz). Default 600 (high female/child voice) */
  maxFrequency?: number;
  /** RMS threshold below which signal is considered silent. Default 0.01 */
  silenceThreshold?: number;
  /** Number of recent pitch frames to keep for stability calculation */
  stabilityWindow?: number;
  /** YIN threshold for pitch detection. Lower = stricter. Default 0.15 */
  yinThreshold?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const DEFAULT_CONFIG: Required<PitchAnalysisConfig> = {
  fftSize: 2048,
  minFrequency: 50,
  maxFrequency: 600,
  silenceThreshold: 0.01,
  stabilityWindow: 30,
  yinThreshold: 0.15,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert frequency to MIDI note number */
export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Convert MIDI note number to note name */
export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[Math.round(midi) % 12];
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${note}${octave}`;
}

/** Convert frequency to note name */
export function freqToNoteName(freq: number): string {
  return midiToNoteName(freqToMidi(freq));
}

/** Compute RMS energy of a Float32Array signal */
export function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * YIN pitch detection algorithm (simplified).
 * Returns { frequency, confidence } or null if no pitch found.
 * 
 * Based on: "YIN, a fundamental frequency estimator for speech and music"
 * by A. de Cheveigné and H. Kawahara, 2002.
 */
export function yinPitchDetect(
  buffer: Float32Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
  threshold: number
): { frequency: number; confidence: number } | null {
  const bufferSize = buffer.length;
  const halfBuffer = Math.floor(bufferSize / 2);

  // Lag range from frequency bounds
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), halfBuffer);

  if (minLag >= maxLag || maxLag >= halfBuffer) return null;

  // Step 1 & 2: Difference function + cumulative mean normalized difference
  const yinBuffer = new Float32Array(maxLag + 1);
  yinBuffer[0] = 1;

  let runningSum = 0;

  for (let tau = 1; tau <= maxLag; tau++) {
    let diff = 0;
    for (let i = 0; i < halfBuffer; i++) {
      const delta = buffer[i] - buffer[i + tau];
      diff += delta * delta;
    }
    runningSum += diff;
    yinBuffer[tau] = runningSum === 0 ? 1 : (diff * tau) / runningSum;
  }

  // Step 3: Absolute threshold — find first dip below threshold
  let bestTau = -1;
  for (let tau = minLag; tau < maxLag; tau++) {
    if (yinBuffer[tau] < threshold) {
      // Find the local minimum
      while (tau + 1 < maxLag && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    // Fallback: find the global minimum in the range
    let minVal = Infinity;
    for (let tau = minLag; tau < maxLag; tau++) {
      if (yinBuffer[tau] < minVal) {
        minVal = yinBuffer[tau];
        bestTau = tau;
      }
    }
    // Only use fallback if it's reasonably good
    if (minVal > 0.5) return null;
  }

  // Step 4: Parabolic interpolation for sub-sample accuracy
  let betterTau: number;
  if (bestTau > 0 && bestTau < maxLag) {
    const s0 = yinBuffer[bestTau - 1];
    const s1 = yinBuffer[bestTau];
    const s2 = yinBuffer[bestTau + 1];
    const shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
    if (isFinite(shift)) {
      betterTau = bestTau + shift;
    } else {
      betterTau = bestTau;
    }
  } else {
    betterTau = bestTau;
  }

  const frequency = sampleRate / betterTau;
  const confidence = 1 - (yinBuffer[bestTau] ?? 0.5);

  if (frequency < minFreq || frequency > maxFreq) return null;

  return { frequency, confidence: Math.max(0, Math.min(1, confidence)) };
}

// ── PitchAnalyzer class ──────────────────────────────────────────────────────

export class PitchAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animFrameId: number = 0;
  private running = false;
  private config: Required<PitchAnalysisConfig>;

  /** Ring buffer of recent pitched frequencies for stability calculation */
  private recentPitches: number[] = [];

  /** History of all frames for audiogram rendering */
  public history: PitchFrame[] = [];
  public maxHistoryLength = 600; // ~10 seconds at 60fps

  /** Callback fired each analysis frame */
  public onFrame: ((frame: PitchFrame) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  constructor(config: PitchAnalysisConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Request mic access and start analysis loop */
  async start(): Promise<void> {
    if (this.running) return;

    try {
      // Request microphone — optimized for voice on Android Chrome
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Lower sample rate for faster processing on mobile
          sampleRate: { ideal: 48000 },
          channelCount: 1,
        },
        video: false,
      });

      // Create audio context (use webkitAudioContext fallback for older Android)
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 48000 });

      // Resume context (required by Chrome autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Connect source → analyser
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.config.fftSize;
      this.analyserNode.smoothingTimeConstant = 0.3;
      this.sourceNode.connect(this.analyserNode);

      this.running = true;
      this.recentPitches = [];
      this.history = [];

      // Start the analysis loop
      this.loop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.onError?.(`Microphone access failed: ${msg}`);
      throw err;
    }
  }

  /** Stop analysis and release resources */
  stop(): void {
    this.running = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }

    this.sourceNode?.disconnect();
    this.sourceNode = null;

    this.analyserNode?.disconnect();
    this.analyserNode = null;

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  /** Returns whether the analyzer is currently running */
  get isRunning(): boolean {
    return this.running;
  }

  /** Returns the sample rate */
  get sampleRate(): number {
    return this.audioContext?.sampleRate ?? 48000;
  }

  /** Main analysis loop — runs via requestAnimationFrame for ~60fps */
  private loop = (): void => {
    if (!this.running || !this.analyserNode) return;

    const frame = this.analyze();
    if (frame) {
      // Push to history
      this.history.push(frame);
      if (this.history.length > this.maxHistoryLength) {
        this.history = this.history.slice(-this.maxHistoryLength);
      }

      this.onFrame?.(frame);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /** Run one analysis frame */
  private analyze(): PitchFrame | null {
    if (!this.analyserNode || !this.audioContext) return null;

    const bufferLength = this.analyserNode.fftSize;
    const buffer = new Float32Array(bufferLength);
    this.analyserNode.getFloatTimeDomainData(buffer);

    const now = performance.now();

    // ── RMS energy ───────────────────────────────────────────────────────
    const rms = computeRMS(buffer);

    // ── Silence gate ─────────────────────────────────────────────────────
    if (rms < this.config.silenceThreshold) {
      return {
        pitch: 0,
        rms,
        confidence: 0,
        voiced: false,
        pitchStability: 0,
        midiNote: null,
        noteName: null,
        timestamp: now,
      };
    }

    // ── Pitch detection (YIN) ────────────────────────────────────────────
    const result = yinPitchDetect(
      buffer,
      this.audioContext.sampleRate,
      this.config.minFrequency,
      this.config.maxFrequency,
      this.config.yinThreshold,
    );

    const voiced = result !== null && result.confidence > 0.5;
    const pitch = voiced && result ? result.frequency : 0;
    const confidence = result?.confidence ?? 0;

    // ── Pitch stability (std-dev of recent pitches) ──────────────────────
    if (pitched(pitch)) {
      this.recentPitches.push(pitch);
      if (this.recentPitches.length > this.config.stabilityWindow) {
        this.recentPitches.shift();
      }
    }

    const pitchStability = this.computeStability();

    // ── Note mapping ─────────────────────────────────────────────────────
    const midiNote = pitched(pitch) ? freqToMidi(pitch) : null;
    const noteName = pitched(pitch) ? freqToNoteName(pitch) : null;

    return {
      pitch,
      rms,
      confidence,
      voiced,
      pitchStability,
      midiNote,
      noteName,
      timestamp: now,
    };
  }

  /** Compute standard deviation of recent pitches */
  private computeStability(): number {
    const p = this.recentPitches;
    if (p.length < 2) return 0;

    const mean = p.reduce((a, b) => a + b, 0) / p.length;
    const variance = p.reduce((sum, v) => sum + (v - mean) ** 2, 0) / p.length;
    return Math.sqrt(variance);
  }
}

/** Helper: true when frequency is a valid pitch */
function pitched(f: number): boolean {
  return f > 0 && isFinite(f);
}
