"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { getTestSoundDescription, type HapticState } from '@/lib/laryngealHaptics';

// ── Types ────────────────────────────────────────────────────────────────────

interface LaryngealHapticsPanelProps {
  /** Current haptic engine state */
  state: HapticState;
  /** Whether haptics are enabled */
  enabled: boolean;
  /** Toggle enabled */
  onToggleEnabled: (enabled: boolean) => void;
  /** Play a test vibration pattern */
  onPlayTest: (sound: 'v' | 'm' | 'z' | 'ah' | 'ee' | 'rising' | 'falling') => void;
  /** Whether the Vibration API is supported on this device */
  isSupported: boolean;
  /** Whether pitch analysis is currently active */
  isAnalysisActive: boolean;
}

// ── Test Sounds ──────────────────────────────────────────────────────────────

const TEST_SOUNDS: Array<{
  key: 'v' | 'm' | 'z' | 'ah' | 'ee' | 'rising' | 'falling';
  label: string;
  emoji: string;
  color: string;
}> = [
  { key: 'v',       label: '"V"',     emoji: '🫦', color: 'bg-purple-600 hover:bg-purple-500' },
  { key: 'm',       label: '"M"',     emoji: '👃', color: 'bg-indigo-600 hover:bg-indigo-500' },
  { key: 'z',       label: '"Z"',     emoji: '🐝', color: 'bg-yellow-600 hover:bg-yellow-500' },
  { key: 'ah',      label: '"AH"',    emoji: '😮', color: 'bg-red-600 hover:bg-red-500' },
  { key: 'ee',      label: '"EE"',    emoji: '😁', color: 'bg-sky-600 hover:bg-sky-500' },
  { key: 'rising',  label: 'Rise ↑',  emoji: '📈', color: 'bg-emerald-600 hover:bg-emerald-500' },
  { key: 'falling', label: 'Fall ↓',  emoji: '📉', color: 'bg-orange-600 hover:bg-orange-500' },
];

// ── Throat Visualization (canvas) ────────────────────────────────────────────

const ThroatVisualizer: React.FC<{ state: HapticState }> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 280;
    const h = 100;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const now = performance.now();

    if (state.isVibrating && state.currentPattern.length > 0) {
      // Calculate which part of the pattern we're in
      const totalMs = state.patternDurationMs || 1;
      const phase = (now % totalMs) / totalMs;

      // Draw vibration rings emanating from center
      const numRings = 5;
      for (let i = 0; i < numRings; i++) {
        const ringPhase = ((phase + i / numRings) % 1);
        const radius = 8 + ringPhase * 50;
        const alpha = (1 - ringPhase) * 0.6;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`; // purple
        ctx.lineWidth = 2 + (1 - ringPhase) * 3;
        ctx.stroke();
      }

      // Center throat marker — pulsing
      const pulseSize = 6 + Math.sin(now * 0.02) * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw waveform representation of pattern
      const patternX = 20;
      const patternW = w - 40;
      const patternY = h - 18;
      const patternH = 12;
      
      let x = patternX;
      const totalPatternWidth = patternW;
      const patternTotal = state.currentPattern.reduce((a, b) => a + b, 0) || 1;

      for (let i = 0; i < state.currentPattern.length; i++) {
        const segWidth = (state.currentPattern[i] / patternTotal) * totalPatternWidth;
        const isOn = i % 2 === 0;

        if (isOn) {
          ctx.fillStyle = `rgba(168, 85, 247, 0.8)`;
          ctx.fillRect(x, patternY - patternH / 2, segWidth, patternH);
        } else {
          ctx.fillStyle = `rgba(71, 85, 105, 0.3)`;
          ctx.fillRect(x, patternY - 1, segWidth, 2);
        }
        x += segWidth;
      }

      // Playhead
      const playheadX = patternX + (phase * totalPatternWidth);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(playheadX - 1, patternY - patternH / 2 - 2, 2, patternH + 4);
    } else {
      // Idle state — dim throat marker
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#475569';
      ctx.fill();

      ctx.fillStyle = '#475569';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Motor idle', cx, cy + 25);
    }
  }, [state]);

  useEffect(() => {
    const loop = () => {
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 280, height: 100 }}
      className="rounded-lg w-full"
    />
  );
};

// ── Main Panel ───────────────────────────────────────────────────────────────

const LaryngealHapticsPanel: React.FC<LaryngealHapticsPanelProps> = ({
  state,
  enabled,
  onToggleEnabled,
  onPlayTest,
  isSupported,
  isAnalysisActive,
}) => {
  const [hoveredSound, setHoveredSound] = React.useState<string | null>(null);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            state.isVibrating ? 'bg-purple-400 animate-pulse' : enabled ? 'bg-slate-500' : 'bg-red-500'
          }`} />
          <h3 className="font-semibold text-sm text-slate-200">
            📳 Laryngeal Haptic Feedback
          </h3>
          {state.isVibrating && (
            <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full font-mono border border-purple-500/30">
              VIBRATING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Update rate */}
          {isAnalysisActive && (
            <span className="text-[10px] text-slate-500 font-mono">
              {state.updatesPerSecond} upd/s
            </span>
          )}
          {/* Enable/disable toggle */}
          <button
            onClick={() => onToggleEnabled(!enabled)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              enabled ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Not supported warning */}
      {!isSupported && (
        <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-500/20 text-amber-400 text-xs">
          ⚠️ Vibration API not supported on this device. Use Android Chrome for haptic feedback.
        </div>
      )}

      {/* Live State */}
      {enabled && isAnalysisActive && (
        <div className="p-4 border-b border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {/* Feel */}
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Feel</div>
              <div className={`text-sm font-bold truncate ${state.isVibrating ? 'text-purple-400' : 'text-slate-600'}`}>
                {state.feelLabel}
              </div>
            </div>
            {/* Cycle */}
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Cycle</div>
              <div className="text-sm font-bold font-mono text-sky-400">
                {state.cyclePeriodMs > 0 ? `${state.cyclePeriodMs}ms` : '—'}
              </div>
            </div>
            {/* Pulse */}
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Pulse</div>
              <div className="text-sm font-bold font-mono text-emerald-400">
                {state.onDurationMs > 0 ? `${state.onDurationMs}ms on` : '—'}
              </div>
            </div>
            {/* Pitch input */}
            <div className="bg-slate-800/60 rounded-lg p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Input</div>
              <div className="text-sm font-bold font-mono text-amber-400">
                {state.smoothedPitch > 0 ? `${state.smoothedPitch.toFixed(0)} Hz` : '—'}
              </div>
            </div>
          </div>

          {/* Throat visualizer */}
          <ThroatVisualizer state={state} />

          {/* Pattern display */}
          {state.currentPattern.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[10px] text-slate-500 font-mono shrink-0">Pattern:</span>
              {state.currentPattern.map((ms, i) => (
                <span
                  key={i}
                  className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                    i % 2 === 0
                      ? 'bg-purple-900/50 text-purple-300 border border-purple-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {ms}
                </span>
              ))}
              <span className="text-[10px] text-slate-600 font-mono">
                = {state.patternDurationMs}ms
              </span>
            </div>
          )}
        </div>
      )}

      {/* Test Sounds */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Test Vibration Patterns
          </h4>
          <span className="text-[10px] text-slate-600">Tap to feel</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {TEST_SOUNDS.map((sound) => (
            <button
              key={sound.key}
              onClick={() => onPlayTest(sound.key)}
              onMouseEnter={() => setHoveredSound(sound.key)}
              onMouseLeave={() => setHoveredSound(null)}
              disabled={!isSupported || !enabled}
              className={`${sound.color} text-white text-[11px] font-medium px-2 py-2 rounded-lg transition-all 
                disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center gap-0.5`}
              title={getTestSoundDescription(sound.key)}
            >
              <span className="text-base">{sound.emoji}</span>
              <span>{sound.label}</span>
            </button>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredSound && (
          <div className="mt-2 text-[11px] text-slate-400 bg-slate-800/60 rounded-lg px-3 py-2 transition-all">
            {getTestSoundDescription(hoveredSound as 'v')}
          </div>
        )}

        {/* Idle message */}
        {!isAnalysisActive && enabled && (
          <div className="mt-3 text-center">
            <p className="text-xs text-slate-500">
              Start <span className="text-emerald-400 font-medium">Pitch Analysis</span> above to activate live throat vibration feedback.
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="mt-3 bg-slate-800/40 rounded-lg p-3">
          <h5 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">How it works</h5>
          <div className="text-[11px] text-slate-500 space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-purple-400">●</span>
              <span>Low pitch → slow, deep vibration pulses</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-400">●</span>
              <span>High pitch → fast, light vibration pulses</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400">●</span>
              <span>Louder → stronger, longer bursts</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-amber-400">●</span>
              <span>Unvoiced sounds (like &quot;S&quot;) → motor stops</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaryngealHapticsPanel;
