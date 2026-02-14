"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { usePitchAnalysis } from '@/hooks/usePitchAnalysis';
import { useLaryngealHaptics } from '@/hooks/useLaryngealHaptics';
import Audiogram from '@/components/Audiogram';
import LaryngealHapticsPanel from '@/components/LaryngealHapticsPanel';
import type { PitchFrame } from '@/lib/pitchAnalysis';

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyPitch(hz: number): { label: string; color: string } {
  if (hz === 0) return { label: 'Silent', color: 'text-gray-500' };
  if (hz < 120) return { label: 'Low (bass)', color: 'text-blue-400' };
  if (hz < 200) return { label: 'Low-mid', color: 'text-cyan-400' };
  if (hz < 300) return { label: 'Mid', color: 'text-green-400' };
  if (hz < 400) return { label: 'High-mid', color: 'text-yellow-400' };
  return { label: 'High', color: 'text-orange-400' };
}

function stabilityLabel(std: number): { label: string; color: string; emoji: string } {
  if (std < 5) return { label: 'Very Stable', color: 'text-emerald-400', emoji: '🎯' };
  if (std < 15) return { label: 'Stable', color: 'text-green-400', emoji: '✅' };
  if (std < 40) return { label: 'Moderate', color: 'text-yellow-400', emoji: '〰️' };
  if (std < 80) return { label: 'Unstable', color: 'text-orange-400', emoji: '📈' };
  return { label: 'Very Unstable', color: 'text-red-400', emoji: '⚡' };
}

function formatHz(hz: number): string {
  if (hz === 0) return '—';
  return `${hz.toFixed(1)} Hz`;
}

function energyBar(rms: number): number {
  return Math.min(Math.round(rms * 300), 100);
}

// ── Stat Display ─────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
}> = ({ label, value, sub, color = 'text-white', icon }) => (
  <div className="bg-slate-800/60 rounded-lg p-3 flex flex-col gap-0.5 min-w-0">
    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold truncate">
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </span>
    <span className={`text-lg font-bold font-mono leading-tight truncate ${color}`}>{value}</span>
    {sub && <span className="text-[10px] text-slate-500 truncate">{sub}</span>}
  </div>
);

// ── Pitch History Mini Stats ─────────────────────────────────────────────────

function useStats(history: PitchFrame[]) {
  return useMemo(() => {
    const voiced = history.filter((f) => f.voiced && f.pitch > 0);
    if (voiced.length === 0) {
      return { avg: 0, min: 0, max: 0, voicedPct: 0, avgRms: 0 };
    }

    const pitches = voiced.map((f) => f.pitch);
    const avg = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const min = Math.min(...pitches);
    const max = Math.max(...pitches);
    const voicedPct = (voiced.length / history.length) * 100;
    const avgRms = history.reduce((a, f) => a + f.rms, 0) / history.length;

    return { avg, min, max, voicedPct, avgRms };
  }, [history]);
}

// ── Main Component ───────────────────────────────────────────────────────────

const PitchAnalysisPanel: React.FC = () => {
  const {
    isActive,
    isStarting,
    currentFrame,
    history,
    error,
    toggle,
    clearHistory,
  } = usePitchAnalysis({
    fftSize: 2048,
    minFrequency: 50,
    maxFrequency: 600,
    silenceThreshold: 0.008,
    stabilityWindow: 30,
    yinThreshold: 0.15,
  });

  // Laryngeal haptic feedback — driven by pitch analysis
  const haptics = useLaryngealHaptics({
    minPitch: 80,
    maxPitch: 400,
    updateIntervalMs: 50,
    smoothingAlpha: 0.35,
    pulsesPerBatch: 4,
  });

  // Feed every pitch frame into the haptic engine
  useEffect(() => {
    if (currentFrame && isActive) {
      haptics.feed(currentFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrame, isActive]);

  // Stop haptics when analysis stops
  useEffect(() => {
    if (!isActive) {
      haptics.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const [showMode, setShowMode] = useState<'combined' | 'pitch' | 'energy'>('combined');

  const stats = useStats(history);
  const pitchClass = currentFrame ? classifyPitch(currentFrame.pitch) : classifyPitch(0);
  const stability = currentFrame ? stabilityLabel(currentFrame.pitchStability) : stabilityLabel(0);
  const energy = currentFrame ? energyBar(currentFrame.rms) : 0;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden shadow-lg">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <h3 className="font-semibold text-sm text-slate-200">
            🎙️ Real-Time Pitch Analysis
          </h3>
          {isActive && currentFrame && (
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {history.length} frames
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mode selector */}
          <div className="flex bg-slate-800 rounded-lg text-[10px] overflow-hidden">
            {(['combined', 'pitch', 'energy'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setShowMode(m)}
                className={`px-2 py-1 capitalize transition-colors ${
                  showMode === m ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {isActive && (
            <button
              onClick={clearHistory}
              className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1"
            >
              Clear
            </button>
          )}

          <button
            onClick={toggle}
            disabled={isStarting}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30'
                : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30'
            } ${isStarting ? 'opacity-50 cursor-wait' : ''}`}
          >
            {isStarting ? 'Starting...' : isActive ? '⏹ Stop' : '🎙️ Start Mic'}
          </button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-500/20 text-red-400 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* ── Live Stats ──────────────────────────────────────────────────── */}
      {isActive && currentFrame && (
        <div className="p-4 border-b border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard
              label="Pitch"
              value={formatHz(currentFrame.pitch)}
              sub={currentFrame.noteName ?? '—'}
              color={currentFrame.voiced ? 'text-sky-400' : 'text-slate-600'}
              icon="🎵"
            />
            <StatCard
              label="Tonality"
              value={pitchClass.label}
              sub={`Confidence: ${(currentFrame.confidence * 100).toFixed(0)}%`}
              color={pitchClass.color}
              icon="🎼"
            />
            <StatCard
              label="Voice"
              value={currentFrame.voiced ? 'Voiced' : 'Unvoiced'}
              sub={`RMS: ${(currentFrame.rms * 100).toFixed(1)}%`}
              color={currentFrame.voiced ? 'text-emerald-400' : 'text-slate-500'}
              icon={currentFrame.voiced ? '🗣️' : '🔇'}
            />
            <StatCard
              label="Stability"
              value={`${stability.emoji} ${stability.label}`}
              sub={`σ = ${currentFrame.pitchStability.toFixed(1)} Hz`}
              color={stability.color}
            />
          </div>

          {/* Energy meter */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Intensity</span>
              <span className="text-[10px] text-slate-400 font-mono">{(currentFrame.rms * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{
                  width: `${energy}%`,
                  background: energy > 70
                    ? 'linear-gradient(90deg, #a78bfa, #ef4444)'
                    : energy > 40
                    ? 'linear-gradient(90deg, #38bdf8, #a78bfa)'
                    : 'linear-gradient(90deg, #34d399, #38bdf8)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Audiogram Canvas ────────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <Audiogram
          history={history}
          width={560}
          height={220}
          minFreq={50}
          maxFreq={500}
          mode={showMode}
        />
      </div>

      {/* ── Laryngeal Haptic Feedback ───────────────────────────────────── */}
      <div className="px-4 pb-3">
        <LaryngealHapticsPanel
          state={haptics.state}
          enabled={haptics.enabled}
          onToggleEnabled={haptics.setEnabled}
          onPlayTest={haptics.playTest}
          isSupported={haptics.isSupported}
          isAnalysisActive={isActive}
        />
      </div>

      {/* ── Session Summary ─────────────────────────────────────────────── */}
      {isActive && history.length > 10 && (
        <div className="px-4 pb-4">
          <div className="bg-slate-800/40 rounded-lg p-3">
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Session Summary</h4>
            <div className="grid grid-cols-5 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Avg Pitch</div>
                <div className="font-mono text-sky-400 font-medium">{formatHz(stats.avg)}</div>
              </div>
              <div>
                <div className="text-slate-500">Min</div>
                <div className="font-mono text-blue-400 font-medium">{formatHz(stats.min)}</div>
              </div>
              <div>
                <div className="text-slate-500">Max</div>
                <div className="font-mono text-orange-400 font-medium">{formatHz(stats.max)}</div>
              </div>
              <div>
                <div className="text-slate-500">Voiced</div>
                <div className="font-mono text-emerald-400 font-medium">{stats.voicedPct.toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-slate-500">Avg Energy</div>
                <div className="font-mono text-violet-400 font-medium">{(stats.avgRms * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Idle state ──────────────────────────────────────────────────── */}
      {!isActive && !error && (
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-slate-500">
            Tap <span className="text-emerald-400 font-medium">Start Mic</span> to begin real-time pitch analysis.
            <br />
            <span className="text-slate-600">Analyzes pitch, intensity, voice detection &amp; stability at ~60 FPS</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default PitchAnalysisPanel;
