"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RecordedFrame,
  RecordingSession,
  saveRecording,
  getRecordingsList,
  loadRecordingFrames,
  deleteRecording,
  getStorageUsage,
} from "@/lib/storage";

interface LipLandmark {
  x: number;
  y: number;
  z: number;
  index: number;
}

interface RecordingControlsProps {
  /** Whether we are currently receiving frames from the live feed */
  isLive: boolean;
  /** Current live frame source (base64 data URL) */
  currentFrameSrc: string | null;
  /** Current landmarks from the live feed */
  currentLandmarks: LipLandmark[];
  /** Current lip bounding box */
  currentBoundingBox: { x: number; y: number; width: number; height: number } | null;
  /** Current mouth openness */
  currentMouthOpenness: number;
  /** Current detected phoneme */
  currentPhoneme: string | null;
  /** Current haptic pattern */
  currentHapticPattern: number[] | null;
  /** Called when playback starts - parent should display playback frames */
  onPlaybackFrame?: (frame: RecordedFrame) => void;
  /** Called when playback emits a haptic */
  onPlaybackHaptic?: (pattern: number[]) => void;
  /** Called when playback stops */
  onPlaybackStop?: () => void;
  /** Current transcript text */
  transcript?: string;
  /** Current translation text */
  translation?: string;
  /** Target language for translation */
  targetLanguage?: string;
}

export default function RecordingControls({
  isLive,
  currentFrameSrc,
  currentLandmarks,
  currentBoundingBox,
  currentMouthOpenness,
  currentPhoneme,
  currentHapticPattern,
  onPlaybackFrame,
  onPlaybackHaptic,
  onPlaybackStop,
  transcript = "",
  translation = "",
  targetLanguage = "",
}: RecordingControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackSessionId, setPlaybackSessionId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [storageInfo, setStorageInfo] = useState({ used: 0, recordings: 0 });
  const [recordingName, setRecordingName] = useState("");

  const framesRef = useRef<RecordedFrame[]>([]);
  const recordingStartRef = useRef(0);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load recordings list on mount
  useEffect(() => {
    setRecordings(getRecordingsList());
    setStorageInfo(getStorageUsage());
  }, []);

  // Capture frames while recording
  useEffect(() => {
    if (!isRecording || !currentFrameSrc) return;

    const frame: RecordedFrame = {
      timestamp: Date.now(),
      frameSrc: currentFrameSrc,
      landmarks: currentLandmarks,
      lipBoundingBox: currentBoundingBox,
      mouthOpenness: currentMouthOpenness,
      phoneme: currentPhoneme,
      hapticPattern: currentHapticPattern,
    };
    framesRef.current.push(frame);
  }, [
    isRecording,
    currentFrameSrc,
    currentLandmarks,
    currentBoundingBox,
    currentMouthOpenness,
    currentPhoneme,
    currentHapticPattern,
  ]);

  const startRecording = useCallback(() => {
    framesRef.current = [];
    recordingStartRef.current = Date.now();
    setRecordingDuration(0);
    setIsRecording(true);

    durationTimerRef.current = setInterval(() => {
      setRecordingDuration(Date.now() - recordingStartRef.current);
    }, 100);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    const frames = framesRef.current;
    if (frames.length > 0) {
      const session = saveRecording(
        recordingName,
        frames,
        transcript,
        translation,
        targetLanguage
      );
      if (session) {
        setRecordings(getRecordingsList());
        setStorageInfo(getStorageUsage());
        setRecordingName("");
      }
    }
    framesRef.current = [];
  }, [recordingName, transcript, translation, targetLanguage]);

  const startPlayback = useCallback(
    (sessionId: string) => {
      const frames = loadRecordingFrames(sessionId);
      if (frames.length === 0) return;

      setIsPlaying(true);
      setPlaybackSessionId(sessionId);
      setPlaybackProgress(0);

      const startTimestamp = frames[0].timestamp;
      const totalDuration = frames[frames.length - 1].timestamp - startTimestamp;
      let frameIndex = 0;

      const playNext = () => {
        if (frameIndex >= frames.length) {
          // Playback complete
          setIsPlaying(false);
          setPlaybackSessionId(null);
          setPlaybackProgress(1);
          onPlaybackStop?.();
          return;
        }

        const frame = frames[frameIndex];
        onPlaybackFrame?.(frame);

        // Trigger haptic if present
        if (frame.hapticPattern && frame.hapticPattern.length > 0) {
          onPlaybackHaptic?.(frame.hapticPattern);
          if (navigator.vibrate) {
            navigator.vibrate(frame.hapticPattern);
          }
        }

        // Update progress
        const progress = totalDuration > 0
          ? (frame.timestamp - startTimestamp) / totalDuration
          : 0;
        setPlaybackProgress(progress);

        frameIndex++;
        if (frameIndex < frames.length) {
          const delay = frames[frameIndex].timestamp - frame.timestamp;
          playbackTimerRef.current = setTimeout(playNext, Math.max(delay, 16));
        } else {
          // Last frame
          setIsPlaying(false);
          setPlaybackSessionId(null);
          setPlaybackProgress(1);
          onPlaybackStop?.();
        }
      };

      playNext();
    },
    [onPlaybackFrame, onPlaybackHaptic, onPlaybackStop]
  );

  const stopPlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackSessionId(null);
    setPlaybackProgress(0);
    onPlaybackStop?.();
  }, [onPlaybackStop]);

  const handleDelete = useCallback((id: string) => {
    deleteRecording(id);
    setRecordings(getRecordingsList());
    setStorageInfo(getStorageUsage());
  }, []);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          {isRecording && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          Recording
        </h3>

        {/* Recording name input */}
        {!isRecording && (
          <input
            type="text"
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            placeholder="Recording name (optional)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-indigo-500"
          />
        )}

        <div className="flex gap-2 mb-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!isLive}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 rounded-full bg-white" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 rounded-sm bg-white" />
              Stop ({formatDuration(recordingDuration)})
            </button>
          )}
        </div>

        {isRecording && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording... {framesRef.current.length} frames captured
          </div>
        )}
      </div>

      {/* Playback Controls (visible during playback) */}
      {isPlaying && (
        <div className="bg-gray-900 rounded-xl border border-indigo-700 p-4">
          <h3 className="text-sm font-semibold text-indigo-400 mb-3">
            Playing Recording
          </h3>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-100"
              style={{ width: `${playbackProgress * 100}%` }}
            />
          </div>
          <button
            onClick={stopPlayback}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ⏹ Stop Playback
          </button>
        </div>
      )}

      {/* Saved Recordings List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400">
            Saved Recordings ({recordings.length})
          </h3>
          <span className="text-[10px] text-gray-600 font-mono">
            {formatBytes(storageInfo.used)} used
          </span>
        </div>

        {recordings.length === 0 ? (
          <div className="text-center text-gray-600 text-xs py-6">
            No recordings yet. Start recording to capture a session.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className={`p-3 rounded-lg border text-xs transition-colors ${
                  playbackSessionId === rec.id
                    ? "bg-indigo-900/30 border-indigo-600"
                    : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white truncate max-w-[150px]">
                    {rec.name}
                  </span>
                  <span className="text-gray-500">
                    {formatDuration(rec.duration)}
                  </span>
                </div>
                <div className="text-gray-500 mb-2">
                  {rec.frameCount} frames ·{" "}
                  {new Date(rec.createdAt).toLocaleDateString()}
                </div>
                {rec.transcript && (
                  <div className="text-gray-400 mb-1 truncate">
                    📝 {rec.transcript}
                  </div>
                )}
                {rec.translation && (
                  <div className="text-indigo-400 mb-1 truncate">
                    🌐 {rec.translation}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => startPlayback(rec.id)}
                    disabled={isPlaying || isRecording}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors"
                  >
                    ▶ Play with Haptics
                  </button>
                  <button
                    onClick={() => handleDelete(rec.id)}
                    disabled={isPlaying && playbackSessionId === rec.id}
                    className="bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white px-2 py-1.5 rounded text-xs font-medium transition-colors"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
