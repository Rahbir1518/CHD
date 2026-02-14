"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ConnectionStatus from "@/components/ConnectionStatus";
import { usePitchAnalysis } from "@/hooks/usePitchAnalysis";
import { useLaryngealHaptics } from "@/hooks/useLaryngealHaptics";
import { getTestSoundDescription, isVibrationSupported } from "@/lib/laryngealHaptics";

interface LipBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function StudentPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [serverUrl, setServerUrl] = useState("ws://192.168.1.X:8000/ws/video");
  const [processedFrameSrc, setProcessedFrameSrc] = useState<string | null>(null);
  const [mouthState, setMouthState] = useState("unknown");
  const [lipBbox, setLipBbox] = useState<LipBoundingBox | null>(null);
  const [showProcessed, setShowProcessed] = useState(true);
  const [showHapticPanel, setShowHapticPanel] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(true);

  // ── Local pitch analysis (runs on-device for zero-latency haptics) ──
  const pitch = usePitchAnalysis({
    fftSize: 2048,
    minFrequency: 50,
    maxFrequency: 600,
    silenceThreshold: 0.008,
    yinThreshold: 0.15,
  });

  // ── Laryngeal haptic engine (converts pitch → dynamic vibration) ──
  const haptics = useLaryngealHaptics({
    minPitch: 80,
    maxPitch: 400,
    updateIntervalMs: 50,
    smoothingAlpha: 0.35,
    pulsesPerBatch: 4,
  });

  // Feed every pitch frame into the haptic engine for real-time vibration
  useEffect(() => {
    if (pitch.currentFrame && pitch.isActive) {
      haptics.feed(pitch.currentFrame);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch.currentFrame, pitch.isActive]);

  // Stop haptics when pitch analysis stops
  useEffect(() => {
    if (!pitch.isActive) {
      haptics.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch.isActive]);

  // Initialize with window location if possible (use wss:// when page is HTTPS)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
      setServerUrl(`${wsScheme}://${host}:8000/ws/video`);
      setIsSecureContext(window.isSecureContext);
    }
  }, []);

  // Test vibration (must run in direct response to user tap for Chrome to allow it)
  const testVibration = useCallback(() => {
    if (isVibrationSupported()) navigator.vibrate([150, 80, 150]);
  }, []);

  // Start Camera + Mic together
  const startCamera = async () => {
    // Unlock Vibration API: Chrome requires the FIRST vibrate() to be in direct
    // response to a user gesture. Use a noticeable pulse so the user feels it;
    // subsequent vibrations from pitch analysis will then work.
    if (isVibrationSupported()) navigator.vibrate([80, 40, 80]);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Camera API not available. Requires HTTPS or localhost."
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);

      // Auto-start pitch analysis (mic) for haptic feedback
      // The user gesture from tapping this button satisfies browser vibration policy
      try {
        await pitch.start();
      } catch {
        // Mic may be denied separately — camera still works
        console.warn("Microphone denied. Haptic feedback unavailable.");
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      alert(err.message || "Could not access camera.");
    }
  };

  // Connect WebSocket
  const connectSocket = useCallback(() => {
    if (socket) socket.close();
    setStatus("connecting");

    let url = serverUrl.replace(/^http/, "ws");
    if (!url.startsWith("ws")) url = `ws://${url}`;

    const ws = new WebSocket(url);

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Backend haptic feedback (fallback — local pitch engine is primary)
        if (
          data.type === "haptic_feedback" &&
          Array.isArray(data.pattern) &&
          data.pattern.length > 0
        ) {
          // Only use backend patterns if local pitch analysis isn't running
          if (!pitch.isActive && isVibrationSupported()) {
            navigator.vibrate(data.pattern);
          }
        }

        // Processed frame with bounding boxes from server
        if (data.type === "processed_frame" && data.frame_base64) {
          const src = data.frame_base64.startsWith("data:")
            ? data.frame_base64
            : `data:image/jpeg;base64,${data.frame_base64}`;
          setProcessedFrameSrc(src);

          if (data.mouth_state) setMouthState(data.mouth_state);
          if (data.lip_bounding_box) setLipBbox(data.lip_bounding_box);
          else setLipBbox(null);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    setSocket(ws);
  }, [serverUrl, socket, pitch.isActive]);

  // Send frames loop
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isStreaming && socket && socket.readyState === WebSocket.OPEN) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      intervalId = setInterval(() => {
        if (!videoRef.current || !ctx) return;
        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          const scale = 320 / video.videoWidth;
          canvas.width = 320;
          canvas.height = video.videoHeight * scale;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL("image/jpeg", 0.4);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(base64);
          }
        }
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isStreaming, socket]);

  const mouthStateConfig: Record<string, { icon: string; color: string }> = {
    closed: { icon: "😶", color: "text-gray-400" },
    open: { icon: "😮", color: "text-yellow-400" },
    talking: { icon: "🗣️", color: "text-green-400" },
    unknown: { icon: "❓", color: "text-gray-500" },
  };
  const stateInfo = mouthStateConfig[mouthState] || mouthStateConfig.unknown;

  // Pitch display helper
  const pitchLabel = pitch.currentFrame
    ? pitch.currentFrame.pitch > 0
      ? `${pitch.currentFrame.pitch.toFixed(0)} Hz`
      : "—"
    : "—";

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4">
      {!isSecureContext && (
        <div className="mb-3 px-3 py-2 bg-amber-900/50 border border-amber-500/50 rounded-lg text-amber-200 text-sm">
          ⚠️ You used &quot;Proceed anyway&quot; (invalid cert). We still try vibration — tap &quot;Test vibration&quot; to check. If it never vibrates, the browser may be blocking it; try the same page on the same Wi‑Fi with a valid HTTPS hostname later.
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold">Student Cam</h1>
        <div className="flex items-center gap-3">
          {/* Haptic status indicator */}
          {pitch.isActive && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs cursor-pointer transition-colors ${
                haptics.state.isVibrating
                  ? "bg-purple-900/60 border border-purple-500/40 text-purple-300 animate-pulse"
                  : "bg-gray-800 border border-gray-700 text-gray-400"
              }`}
              onClick={() => setShowHapticPanel(!showHapticPanel)}
            >
              <span>📳</span>
              <span>{haptics.state.isVibrating ? haptics.state.feelLabel : "Haptics"}</span>
            </div>
          )}
          {/* Mouth state badge */}
          {mouthState !== "unknown" && (
            <div
              className={`flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-full text-xs ${stateInfo.color}`}
            >
              <span>{stateInfo.icon}</span>
              <span className="capitalize">{mouthState}</span>
            </div>
          )}
          <ConnectionStatus status={status} />
        </div>
      </div>

      {/* Connection Controls */}
      <div className="mb-4 space-y-2 bg-gray-900 p-3 rounded-lg border border-gray-800">
        <label className="text-xs text-gray-400 uppercase font-semibold">
          Server Address
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="flex-1 min-w-0 bg-gray-800 rounded px-3 py-2 text-sm font-mono border border-gray-700 focus:border-blue-500 outline-none"
            placeholder="ws://192.168.x.x:8000/ws/video"
          />
          <button
            onClick={connectSocket}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            Connect
          </button>
          <button
            type="button"
            onClick={testVibration}
            className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-1"
            title="Tap to test if your phone can vibrate (requires HTTPS)"
          >
            📳 Test vibration
          </button>
        </div>
      </div>

      {/* ── Haptic Feedback Panel (collapsible) ── */}
      {showHapticPanel && pitch.isActive && (
        <div className="mb-4 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                haptics.state.isVibrating ? "bg-purple-400 animate-pulse" : haptics.enabled ? "bg-gray-500" : "bg-red-500"
              }`} />
              <span className="text-sm font-semibold text-gray-200">📳 Haptic Vibration</span>
              {haptics.state.isVibrating && (
                <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full font-mono border border-purple-500/30">
                  VIBRATING
                </span>
              )}
            </div>
            {/* Enable/disable toggle */}
            <button
              onClick={() => haptics.setEnabled(!haptics.enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                haptics.enabled ? "bg-purple-600" : "bg-gray-700"
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                haptics.enabled ? "translate-x-5" : "translate-x-0"
              }`} />
            </button>
          </div>

          {!haptics.isSupported && (
            <div className="px-3 py-2 bg-amber-900/30 border-b border-amber-500/20 text-amber-400 text-xs">
              ⚠️ Vibration API not supported. Use Android Chrome for haptic feedback.
            </div>
          )}

          {haptics.enabled && (
            <div className="p-3 space-y-3">
              {/* Live stats row */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                  <div className="text-[9px] uppercase text-gray-500 font-semibold">Pitch</div>
                  <div className="text-sm font-bold font-mono text-sky-400">{pitchLabel}</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                  <div className="text-[9px] uppercase text-gray-500 font-semibold">Feel</div>
                  <div className={`text-sm font-bold truncate ${haptics.state.isVibrating ? "text-purple-400" : "text-gray-600"}`}>
                    {haptics.state.feelLabel}
                  </div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                  <div className="text-[9px] uppercase text-gray-500 font-semibold">Cycle</div>
                  <div className="text-sm font-bold font-mono text-emerald-400">
                    {haptics.state.cyclePeriodMs > 0 ? `${haptics.state.cyclePeriodMs}ms` : "—"}
                  </div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-2 text-center">
                  <div className="text-[9px] uppercase text-gray-500 font-semibold">Energy</div>
                  <div className="text-sm font-bold font-mono text-amber-400">
                    {pitch.currentFrame ? `${(pitch.currentFrame.rms * 100).toFixed(0)}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Vibration intensity bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Vibration Intensity</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {haptics.state.onDurationMs > 0 ? `${haptics.state.onDurationMs}ms pulse` : "idle"}
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75"
                    style={{
                      width: `${haptics.state.isVibrating ? Math.min((haptics.state.onDurationMs / 60) * 100, 100) : 0}%`,
                      background: haptics.state.isVibrating
                        ? "linear-gradient(90deg, #a855f7, #ec4899)"
                        : "#1e293b",
                    }}
                  />
                </div>
              </div>

              {/* Pattern display */}
              {haptics.state.currentPattern.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  <span className="text-[10px] text-gray-500 font-mono shrink-0">Pattern:</span>
                  {haptics.state.currentPattern.map((ms, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                        i % 2 === 0
                          ? "bg-purple-900/50 text-purple-300 border border-purple-500/30"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {ms}
                    </span>
                  ))}
                  <span className="text-[10px] text-gray-600 font-mono">
                    = {haptics.state.patternDurationMs}ms
                  </span>
                </div>
              )}

              {/* Quick test buttons */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1.5">Test Vibrations</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["v", "m", "z", "ah", "ee", "rising", "falling"] as const).map((sound) => (
                    <button
                      key={sound}
                      onClick={() => haptics.playTest(sound)}
                      disabled={!haptics.isSupported || !haptics.enabled}
                      className="bg-purple-700 hover:bg-purple-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-medium px-2 py-1.5 rounded-lg transition-all active:scale-95"
                      title={getTestSoundDescription(sound)}
                    >
                      {sound.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View toggle + Haptic toggle row */}
      <div className="mb-2 flex justify-center gap-2">
        {processedFrameSrc && (
          <button
            onClick={() => setShowProcessed(!showProcessed)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showProcessed
                ? "bg-green-900/40 border-green-600 text-green-400"
                : "bg-gray-800 border-gray-600 text-gray-400"
            }`}
          >
            {showProcessed ? "🎯 Bounding Boxes ON" : "○ Bounding Boxes OFF"}
          </button>
        )}
        {/* Mic/haptic toggle */}
        {isStreaming && (
          <button
            onClick={async () => {
              if (pitch.isActive) {
                pitch.stop();
                haptics.stop();
              } else {
                await pitch.start();
              }
            }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              pitch.isActive
                ? "bg-purple-900/40 border-purple-500 text-purple-400"
                : "bg-gray-800 border-gray-600 text-gray-400"
            }`}
          >
            {pitch.isActive ? "📳 Haptics ON" : "📳 Haptics OFF"}
          </button>
        )}
      </div>

      {/* Camera + Processed Feed */}
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        {/* Raw camera (always running underneath) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            showProcessed && processedFrameSrc ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Processed frame with bounding boxes from server */}
        {showProcessed && processedFrameSrc && (
          <img
            src={processedFrameSrc}
            alt="Processed"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Hidden canvas for frame sending */}
        <canvas ref={processedCanvasRef} className="hidden" />

        {/* Camera start overlay */}
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <button
              onClick={startCamera}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg transform transition active:scale-95 flex items-center gap-2"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Start Camera + Mic
            </button>
          </div>
        )}

        {/* Status overlays */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          {showProcessed && processedFrameSrc && lipBbox && (
            <div className="bg-green-600/70 px-2 py-1 rounded text-xs text-white backdrop-blur-sm animate-pulse">
              🎯 Lip Tracking
            </div>
          )}
          {isStreaming && (
            <div className="bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
              Live
            </div>
          )}
        </div>

        {/* Vibration indicator overlay on video feed */}
        {haptics.state.isVibrating && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-center">
            <div className="bg-purple-900/70 backdrop-blur text-purple-200 text-xs px-4 py-2 rounded-full border border-purple-500/40 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
              <span className="font-mono">{haptics.state.feelLabel}</span>
              <span className="text-purple-400 font-mono">{pitchLabel}</span>
            </div>
          </div>
        )}

        {isStreaming && !processedFrameSrc && status === "connected" && !haptics.state.isVibrating && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1 rounded-full border border-white/20 animate-pulse">
              Processing frames...
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-gray-500 text-xs">
        Ensure phone and dashboard are on the same Wi-Fi · Face the front camera
        {pitch.isActive && (
          <span className="block mt-1 text-purple-400">
            🎙️ Mic active — speak to feel dynamic vibrations
          </span>
        )}
      </div>
    </div>
  );
}
