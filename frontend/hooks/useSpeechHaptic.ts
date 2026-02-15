"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TranscriptChunk {
  text: string;
  intensity: string;
  rms: number;
  timestamp: number;
  chunkIndex: number;
}

interface SpeechHapticState {
  isConnected: boolean;
  isPipelineRunning: boolean;
  transcriptChunks: TranscriptChunk[];
  fullTranscript: string;
  currentIntensity: string;
  currentRms: number;
  chunksReceived: number;
}

interface UseSpeechHapticOptions {
  serverHost?: string;
  autoConnect?: boolean;
  initialVibrationEnabled?: boolean;
}

export function useSpeechHaptic(options: UseSpeechHapticOptions = {}) {
  const { autoConnect = false, initialVibrationEnabled = true } = options;

  const [state, setState] = useState<SpeechHapticState>({
    isConnected: false,
    isPipelineRunning: false,
    transcriptChunks: [],
    fullTranscript: "",
    currentIntensity: "silence",
    currentRms: 0,
    chunksReceived: 0,
  });

  const [vibrationEnabled, setVibrationEnabled] = useState(initialVibrationEnabled);
  const vibrationRef = useRef(initialVibrationEnabled);

  // Sync ref for callback
  useEffect(() => {
    vibrationRef.current = vibrationEnabled;
  }, [vibrationEnabled]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const lastSmsTime = useRef<number>(0);
  const vibrationSupported =
    typeof navigator !== "undefined" && "vibrate" in navigator;

  const getApiBase = useCallback(() => {
    if (options.serverHost) return `http://${options.serverHost}:8000`;
    if (typeof window === "undefined") return "http://localhost:8000";
    return `http://${window.location.hostname}:8000`;
  }, [options.serverHost]);

  const getWsUrl = useCallback(() => {
    if (options.serverHost) return `ws://${options.serverHost}:8000/ws/speech-haptic`;
    if (typeof window === "undefined")
      return "ws://localhost:8000/ws/speech-haptic";
    return `ws://${window.location.hostname}:8000/ws/speech-haptic`;
  }, [options.serverHost]);

  // Connect WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("📳 Speech-haptic WS connected");
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "speech_haptic") {
          // Vibrate the phone if enabled
          if (
            vibrationSupported &&
            vibrationRef.current &&
            data.pattern?.length > 0
          ) {
            navigator.vibrate(data.pattern);
          }

          // [SMS INTEGRATION] Open SMS app on phone (debounced)
          const now = Date.now();
          if (now - lastSmsTime.current > 15000 && data.transcript_chunk) { // 15s debounce
             const body = encodeURIComponent(`Speech Detected: ${data.transcript_chunk}`);
             // Trigger native SMS app (Phone Link on Desktop, Messages on Mobile)
             window.open(`sms:+16475619466?body=${body}`, "_self");
             lastSmsTime.current = now;
          }

          const chunk: TranscriptChunk = {
            text: data.transcript_chunk || "",
            intensity: data.intensity || "medium",
            rms: data.rms || 0,
            timestamp: data.timestamp || Date.now() / 1000,
            chunkIndex: data.chunk_index || 0,
          };

          setState((prev) => ({
            ...prev,
            transcriptChunks: [...prev.transcriptChunks.slice(-49), chunk],
            fullTranscript: data.full_transcript || prev.fullTranscript,
            currentIntensity: chunk.intensity,
            currentRms: chunk.rms,
            chunksReceived: prev.chunksReceived + 1,
          }));
        }

        if (data.type === "speech_haptic_energy") {
          setState((prev) => ({
            ...prev,
            currentRms: data.rms || 0,
          }));
        }

        if (data.type === "tts_cue" && data.audio_base64) {
          // Play the voice cue (e.g. "Listening started")
          try {
            const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
            audio.play().catch(e => console.error("Audio playback blocked/failed:", e));
          } catch (e) {
            console.error("Failed to play TTS cue:", e);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log("📳 Speech-haptic WS disconnected");
      setState((prev) => ({ ...prev, isConnected: false }));
      // Auto-reconnect after 3s
      reconnectRef.current = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
    };
  }, [getWsUrl, vibrationSupported]);

  // ... (disconnect and API calls remain same but scoped)

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  // Start the pipeline (REST call)
  const startPipeline = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/speech-haptic/start`, {
        method: "POST",
      });
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        isPipelineRunning: data.running ?? true,
      }));
      return data;
    } catch (e) {
      console.error("Failed to start pipeline:", e);
      return null;
    }
  }, [getApiBase]);

  // Stop the pipeline (REST call)
  const stopPipeline = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/speech-haptic/stop`, {
        method: "POST",
      });
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        isPipelineRunning: data.running ?? false,
      }));
      return data;
    } catch (e) {
      console.error("Failed to stop pipeline:", e);
      return null;
    }
  }, [getApiBase]);

  // Fetch pipeline status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/api/speech-haptic/status`);
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        isPipelineRunning: data.running ?? false,
      }));
      return data;
    } catch {
      return null;
    }
  }, [getApiBase]);

  // Clear transcript history
  const clearTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      transcriptChunks: [],
      fullTranscript: "",
      chunksReceived: 0,
    }));
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return {
    ...state,
    vibrationSupported,
    vibrationEnabled,
    setVibrationEnabled,
    connect,
    disconnect,
    startPipeline,
    stopPipeline,
    fetchStatus,
    clearTranscript,
  };
}
