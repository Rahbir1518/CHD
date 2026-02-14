"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import type { PitchFrame } from '@/lib/pitchAnalysis';

interface AudiogramProps {
  /** Rolling history of pitch frames */
  history: PitchFrame[];
  /** Width of canvas in px */
  width?: number;
  /** Height of canvas in px */
  height?: number;
  /** Max frequency shown on Y axis */
  maxFreq?: number;
  /** Min frequency shown on Y axis */
  minFreq?: number;
  /** Which data to render */
  mode?: 'pitch' | 'energy' | 'combined';
}

// ── Color palette ────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0f172a',          // slate-900
  grid: '#1e293b',        // slate-800
  gridText: '#64748b',    // slate-500
  pitchLine: '#38bdf8',   // sky-400
  pitchDot: '#0ea5e9',    // sky-500
  pitchGlow: 'rgba(56, 189, 248, 0.15)',
  energyBar: '#a78bfa',   // violet-400
  energyFill: 'rgba(167, 139, 250, 0.3)',
  unvoiced: '#475569',    // slate-600
  voiced: '#34d399',      // emerald-400
  voicedGlow: 'rgba(52, 211, 153, 0.2)',
  stability: '#fbbf24',   // amber-400
  stabilityBad: '#ef4444',// red-500
  crosshair: 'rgba(148, 163, 184, 0.3)',
};

const Audiogram: React.FC<AudiogramProps> = ({
  history,
  width = 600,
  height = 280,
  maxFreq = 500,
  minFreq = 50,
  mode = 'combined',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Convert frequency to Y position
  const freqToY = useCallback(
    (freq: number): number => {
      if (freq <= 0) return height;
      const ratio = (freq - minFreq) / (maxFreq - minFreq);
      return height - ratio * (height - 30) - 15; // 15px padding top/bottom
    },
    [height, maxFreq, minFreq],
  );

  // Convert RMS (0-1) to bar height
  const rmsToHeight = useCallback(
    (rms: number): number => {
      return Math.min(rms * 3, 1) * (height * 0.3); // scale up, cap at 30% canvas
    },
    [height],
  );

  // Main render
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // ── Background ───────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // ── Grid lines (horizontal — frequency markers) ──────────────────────
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.gridText;
    ctx.textAlign = 'right';

    const freqSteps = [100, 150, 200, 250, 300, 400, 500];
    for (const f of freqSteps) {
      if (f > maxFreq || f < minFreq) continue;
      const y = freqToY(f);
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${f}Hz`, 36, y + 3);
    }
    ctx.setLineDash([]);

    if (history.length < 2) {
      // Empty state
      ctx.fillStyle = COLORS.gridText;
      ctx.textAlign = 'center';
      ctx.font = '13px sans-serif';
      ctx.fillText('Waiting for audio input...', width / 2, height / 2);
      return;
    }

    const leftPad = 44;
    const plotWidth = width - leftPad - 8;
    const step = plotWidth / Math.max(history.length - 1, 1);

    // ── Energy bars (background layer) ───────────────────────────────────
    if (mode === 'energy' || mode === 'combined') {
      for (let i = 0; i < history.length; i++) {
        const frame = history[i];
        const x = leftPad + i * step;
        const barH = rmsToHeight(frame.rms);

        ctx.fillStyle = frame.voiced ? COLORS.voicedGlow : COLORS.energyFill;
        ctx.fillRect(x - step / 2, height - barH, step, barH);
      }
    }

    // ── Pitch line (main layer) ──────────────────────────────────────────
    if (mode === 'pitch' || mode === 'combined') {
      // Glow effect
      ctx.save();
      ctx.shadowColor = COLORS.pitchLine;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = COLORS.pitchLine;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      let started = false;

      for (let i = 0; i < history.length; i++) {
        const frame = history[i];
        if (!frame.voiced || frame.pitch <= 0) {
          started = false;
          continue;
        }

        const x = leftPad + i * step;
        const y = freqToY(frame.pitch);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();

      // Dots for voiced frames
      for (let i = 0; i < history.length; i++) {
        const frame = history[i];
        if (!frame.voiced || frame.pitch <= 0) continue;

        const x = leftPad + i * step;
        const y = freqToY(frame.pitch);

        // Confidence-based opacity
        const alpha = 0.3 + frame.confidence * 0.7;
        ctx.fillStyle = `rgba(14, 165, 233, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Voiced/Unvoiced indicator strip at bottom ────────────────────────
    const stripH = 4;
    for (let i = 0; i < history.length; i++) {
      const frame = history[i];
      const x = leftPad + i * step;
      ctx.fillStyle = frame.voiced ? COLORS.voiced : COLORS.unvoiced;
      ctx.fillRect(x - step / 2, height - stripH, step + 1, stripH);
    }

    // ── Current value crosshair (latest frame) ──────────────────────────
    const latest = history[history.length - 1];
    if (latest && latest.voiced && latest.pitch > 0) {
      const x = leftPad + (history.length - 1) * step;
      const y = freqToY(latest.pitch);

      // Horizontal line
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(leftPad, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Value label
      ctx.fillStyle = COLORS.pitchLine;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${latest.pitch.toFixed(0)} Hz`, x - 60, y - 8);

      if (latest.noteName) {
        ctx.fillStyle = COLORS.stability;
        ctx.fillText(latest.noteName, x - 60, y + 14);
      }
    }

    // ── Y-axis label ─────────────────────────────────────────────────────
    ctx.save();
    ctx.fillStyle = COLORS.gridText;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Frequency (Hz)', 0, 0);
    ctx.restore();
  }, [history, width, height, maxFreq, minFreq, mode, freqToY, rmsToHeight]);

  // Render loop
  useEffect(() => {
    const render = () => {
      draw();
      animRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-lg w-full"
    />
  );
};

export default Audiogram;
