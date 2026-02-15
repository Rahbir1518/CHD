"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ConnectionStatus from "@/components/ConnectionStatus";
import { usePitchAnalysis } from "@/hooks/usePitchAnalysis";
import { useLaryngealHaptics } from "@/hooks/useLaryngealHaptics";
import { useSpeechHaptic } from "@/hooks/useSpeechHaptic";
import { getTestSoundDescription } from "@/lib/laryngealHaptics";
import ParticleBackground from "@/components/ParticleBackground";

/* ── Reusable SVG Icon Components ── */
const Icons = {
  vibrate: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 14.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.01" />
    </svg>
  ),
  mic: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
    </svg>
  ),
  camera: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  target: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  speaker: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  ),
  stop: (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  play: (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  warning: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  crosshair: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <line x1="12" y1="2" x2="12" y2="6" strokeWidth={2} />
      <line x1="12" y1="18" x2="12" y2="22" strokeWidth={2} />
      <line x1="2" y1="12" x2="6" y2="12" strokeWidth={2} />
      <line x1="18" y1="12" x2="22" y2="12" strokeWidth={2} />
    </svg>
  ),
};

/* ── Mouth state config (no emojis) ── */
const mouthStateConfig: Record<string, { label: string; dotColor: string; textColor: string }> = {
  closed: { label: "Closed", dotColor: "bg-gray-400", textColor: "text-gray-400" },
  open:   { label: "Open",   dotColor: "bg-amber-400", textColor: "text-amber-400" },
  talking: { label: "Talking", dotColor: "bg-emerald-400", textColor: "text-emerald-400" },
  unknown: { label: "Unknown", dotColor: "bg-gray-600", textColor: "text-gray-500" },
};

interface LipBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function StudentPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connected" | "disconnected" | "error" | "connecting">("disconnected");
  const [serverUrl, setServerUrl] = useState("ws://192.168.1.X:8000/ws/video");
  const [processedFrameSrc, setProcessedFrameSrc] = useState<string | null>(null);
  const [mouthState, setMouthState] = useState("unknown");
  const [lipBbox, setLipBbox] = useState<LipBoundingBox | null>(null);
  const [showProcessed, setShowProcessed] = useState(true);
  const [showHapticPanel, setShowHapticPanel] = useState(false);

  const stateInfo = mouthStateConfig[mouthState] || mouthStateConfig.unknown;

  // ── Local pitch analysis ──
  const pitch = usePitchAnalysis({
    fftSize: 2048,
    minFrequency: 50,
    maxFrequency: 600,
    silenceThreshold: 0.008,
    yinThreshold: 0.15,
  });

  // ── Laryngeal haptic engine ──
  const haptics = useLaryngealHaptics({
    minPitch: 80,
    maxPitch: 400,
    updateIntervalMs: 50,
    smoothingAlpha: 0.35,
    pulsesPerBatch: 4,
  });

  // ── Remote Speech-to-Haptic Pipeline ──
  const speechHaptic = useSpeechHaptic({
    autoConnect: false,
    initialVibrationEnabled: true,
  });

  // Sync Remote Connection
  useEffect(() => {
    if (status === "connected") speechHaptic.connect();
    else if (status === "disconnected") speechHaptic.disconnect();
  }, [status, speechHaptic.connect, speechHaptic.disconnect]);

  // Feed frames → haptic engine
  useEffect(() => {
    if (pitch.currentFrame && pitch.isActive) haptics.feed(pitch.currentFrame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch.currentFrame, pitch.isActive]);

  useEffect(() => {
    if (!pitch.isActive) haptics.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitch.isActive]);

  // Set default server URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      setServerUrl(`ws://${window.location.hostname}:8000/ws/video`);
    }
  }, []);

  // Fade-in on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el) requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  }, []);

  // Start Camera + Mic
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API not available. Requires HTTPS or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsStreaming(true);
      try { await pitch.start(); } catch { console.warn("Microphone denied. Haptic feedback unavailable."); }
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
        if (data.type === "haptic_feedback" && Array.isArray(data.pattern) && data.pattern.length > 0) {
          if (!pitch.isActive && navigator.vibrate) navigator.vibrate(data.pattern);
        }
        if (data.type === "processed_frame" && data.frame_base64) {
          const src = data.frame_base64.startsWith("data:") ? data.frame_base64 : `data:image/jpeg;base64,${data.frame_base64}`;
          setProcessedFrameSrc(src);
          if (data.mouth_state) setMouthState(data.mouth_state);
          if (data.lip_bounding_box) setLipBbox(data.lip_bounding_box);
          else setLipBbox(null);
        }
      } catch { /* ignore */ }
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
          if (socket.readyState === WebSocket.OPEN) socket.send(canvas.toDataURL("image/jpeg", 0.4));
        }
      }, 100);
    }
    return () => clearInterval(intervalId);
  }, [isStreaming, socket]);

  // Pitch display
  const pitchLabel = pitch.currentFrame ? (pitch.currentFrame.pitch > 0 ? `${pitch.currentFrame.pitch.toFixed(0)} Hz` : "\u2014") : "\u2014";

  return (
    <div className="relative flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Background layers */}
      <div className="grain-overlay" />
      <ParticleBackground />

      {/* Main content */}
      <div
        ref={containerRef}
        className="content-layer flex flex-col h-full p-4 transition-all duration-700 ease-out"
        style={{ opacity: 0, transform: "translateY(12px)" }}
      >
        {/* ── Header Bar ── */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-phonix-copper to-phonix-gold flex items-center justify-center">
              {Icons.camera}
            </div>
            <h1 className="font-display font-bold text-lg tracking-tight">
              Student <span className="gradient-text">Cam</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Haptic status */}
            {pitch.isActive && (
              <button
                onClick={() => setShowHapticPanel(!showHapticPanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-300 ${
                  haptics.state.isVibrating
                    ? "glass-panel border border-phonix-copper/50 text-phonix-gold animate-copper-pulse"
                    : "glass-panel border border-white/10 text-gray-400 hover:border-phonix-copper/30"
                }`}
              >
                {Icons.vibrate}
                <span>{haptics.state.isVibrating ? haptics.state.feelLabel : "Haptics"}</span>
              </button>
            )}
            {/* Mouth state */}
            {mouthState !== "unknown" && (
              <div className={`flex items-center gap-1.5 glass-panel px-3 py-1.5 rounded-full text-xs border border-white/10 ${stateInfo.textColor}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${stateInfo.dotColor}`} />
                <span className="font-medium">{stateInfo.label}</span>
              </div>
            )}
            <ConnectionStatus status={status} />
          </div>
        </div>

        {/* ── Connection Controls ── */}
        <div className="mb-4 glass-panel rounded-xl p-4 border border-white/10 space-y-2">
          <label className="text-[10px] text-phonix-gold uppercase font-semibold tracking-widest">
            Server Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="flex-1 bg-[#111] rounded-lg px-3 py-2.5 text-sm font-mono border border-white/10 focus:border-phonix-copper focus:ring-1 focus:ring-phonix-copper/30 outline-none text-white placeholder:text-gray-600 transition-all"
              placeholder="ws://192.168.x.x:8000/ws/video"
            />
            <button
              onClick={connectSocket}
              className="btn-copper px-5 py-2.5 rounded-lg text-sm"
            >
              Connect
            </button>
          </div>
        </div>

        {/* ── Haptic Panel (collapsible) ── */}
        {showHapticPanel && pitch.isActive && (
          <div className="mb-4 glass-panel rounded-xl border border-white/10 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  haptics.state.isVibrating ? "bg-phonix-gold animate-dot-pulse" : haptics.enabled ? "bg-gray-500" : "bg-red-500"
                }`} />
                <span className="text-sm font-semibold text-gray-200 font-display">Haptic Vibration</span>
                {haptics.state.isVibrating && (
                  <span className="text-[10px] bg-phonix-copper/20 text-phonix-gold px-2 py-0.5 rounded-full font-mono border border-phonix-copper/30 uppercase tracking-wider">
                    Active
                  </span>
                )}
              </div>
              <button
                onClick={() => haptics.setEnabled(!haptics.enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${haptics.enabled ? "bg-phonix-copper" : "bg-gray-700"}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${haptics.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {!haptics.isSupported && (
              <div className="px-3 py-2 bg-amber-900/20 border-b border-amber-500/10 text-amber-400 text-xs flex items-center gap-2">
                {Icons.warning}
                <span>Vibration API not supported. Use Android Chrome for haptic feedback.</span>
              </div>
            )}

            {haptics.enabled && (
              <div className="p-3 space-y-3">
                {/* Live stats */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Pitch", value: pitchLabel, color: "text-sky-400" },
                    { label: "Feel", value: haptics.state.feelLabel, color: haptics.state.isVibrating ? "text-phonix-gold" : "text-gray-600" },
                    { label: "Cycle", value: haptics.state.cyclePeriodMs > 0 ? `${haptics.state.cyclePeriodMs}ms` : "\u2014", color: "text-emerald-400" },
                    { label: "Energy", value: pitch.currentFrame ? `${(pitch.currentFrame.rms * 100).toFixed(0)}%` : "\u2014", color: "text-amber-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-black/40 rounded-lg p-2 text-center border border-white/5">
                      <div className="text-[9px] uppercase text-gray-500 font-semibold tracking-wider">{stat.label}</div>
                      <div className={`text-sm font-bold font-mono truncate ${stat.color}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Intensity bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Vibration Intensity</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {haptics.state.onDurationMs > 0 ? `${haptics.state.onDurationMs}ms pulse` : "idle"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-75"
                      style={{
                        width: `${haptics.state.isVibrating ? Math.min((haptics.state.onDurationMs / 60) * 100, 100) : 0}%`,
                        background: haptics.state.isVibrating
                          ? "linear-gradient(90deg, #B87333, #D4A574)"
                          : "transparent",
                      }}
                    />
                  </div>
                </div>

                {/* Pattern */}
                {haptics.state.currentPattern.length > 0 && (
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">Pattern:</span>
                    {haptics.state.currentPattern.map((ms, i) => (
                      <span
                        key={i}
                        className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                          i % 2 === 0
                            ? "bg-phonix-copper/20 text-phonix-gold border border-phonix-copper/30"
                            : "bg-black/30 text-gray-600"
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

                {/* Test buttons */}
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1.5 tracking-wider">Test Vibrations</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["v", "m", "z", "ah", "ee", "rising", "falling"] as const).map((sound) => (
                      <button
                        key={sound}
                        onClick={() => haptics.playTest(sound)}
                        disabled={!haptics.isSupported || !haptics.enabled}
                        className="btn-copper disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-medium px-2 py-1.5 rounded-lg active:scale-95"
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

        {/* ── Remote Haptics (Teacher Voice) ── */}
        {showHapticPanel && (
          <div className="mb-4 glass-panel rounded-xl border border-phonix-copper/20 overflow-hidden">
            <div className="p-3 border-b border-phonix-copper/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-phonix-gold">{Icons.speaker}</span>
                <span className="text-sm font-display font-semibold text-gray-200">Teacher Voice</span>
                {speechHaptic.isConnected && (
                  <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full font-mono border border-emerald-500/20 uppercase tracking-wider">
                    Connected
                  </span>
                )}
              </div>
              {speechHaptic.isConnected && (
                <button
                  onClick={async () => {
                    if (speechHaptic.isPipelineRunning) await speechHaptic.stopPipeline();
                    else await speechHaptic.startPipeline();
                  }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                    speechHaptic.isPipelineRunning
                      ? "btn-danger rounded-full"
                      : "btn-success rounded-full"
                  }`}
                >
                  {speechHaptic.isPipelineRunning ? Icons.stop : Icons.play}
                  <span>{speechHaptic.isPipelineRunning ? "Stop" : "Listen"}</span>
                </button>
              )}
            </div>

            {speechHaptic.isPipelineRunning && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase text-phonix-gold font-semibold tracking-wider">Live Transcript</span>
                  <span className="text-[10px] text-gray-500 font-mono">{speechHaptic.chunksReceived} chunks</span>
                </div>
                <div className="h-16 bg-black/40 rounded-lg p-2 overflow-y-auto text-xs text-gray-200 font-mono custom-scrollbar border border-white/5">
                  {speechHaptic.transcriptChunks.slice(-5).map((c, i) => (
                    <span key={i} className={c.intensity === "high" || c.intensity === "burst" ? "text-white font-bold" : "text-gray-400"}>
                      {c.text}{" "}
                    </span>
                  ))}
                  {speechHaptic.transcriptChunks.length === 0 && (
                    <span className="text-gray-600 italic">Waiting for speech...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Toggle Row ── */}
        <div className="mb-2 flex justify-center gap-2">
          {processedFrameSrc && (
            <button
              onClick={() => setShowProcessed(!showProcessed)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                showProcessed
                  ? "glass-panel border-emerald-500/40 text-emerald-400"
                  : "glass-panel border-white/10 text-gray-500"
              }`}
            >
              {Icons.crosshair}
              <span>{showProcessed ? "Tracking ON" : "Tracking OFF"}</span>
            </button>
          )}
          {isStreaming && (
            <button
              onClick={async () => {
                if (pitch.isActive) { pitch.stop(); haptics.stop(); } else { await pitch.start(); }
              }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                pitch.isActive
                  ? "glass-panel border-phonix-copper/50 text-phonix-gold"
                  : "glass-panel border-white/10 text-gray-500"
              }`}
            >
              {Icons.vibrate}
              <span>{pitch.isActive ? "Haptics ON" : "Haptics OFF"}</span>
            </button>
          )}
        </div>

        {/* ── Camera Feed ── */}
        <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl edge-glow">
          {/* Raw camera */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              showProcessed && processedFrameSrc ? "opacity-0" : "opacity-100"
            }`}
          />

          {/* Processed frame */}
          {showProcessed && processedFrameSrc && (
            <img src={processedFrameSrc} alt="Processed" className="absolute inset-0 w-full h-full object-contain" />
          )}

          <canvas ref={processedCanvasRef} className="hidden" />

          {/* Start overlay */}
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md gap-6">
              {/* Decorative ring */}
              <div className="relative">
                <div className="absolute inset-0 w-24 h-24 rounded-full border border-phonix-copper/30 animate-ping" style={{ animationDuration: "3s" }} />
                <div className="w-24 h-24 rounded-full bg-linear-to-br from-phonix-copper/20 to-phonix-gold/10 flex items-center justify-center border border-phonix-copper/30">
                  <svg className="w-10 h-10 text-phonix-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={startCamera}
                className="btn-copper px-8 py-4 rounded-full text-base flex items-center gap-3 edge-glow"
              >
                {Icons.camera}
                <span>Start Camera &amp; Mic</span>
              </button>
              <p className="text-xs text-gray-600 max-w-xs text-center">
                Camera and microphone access is required for lip tracking and haptic feedback
              </p>
            </div>
          )}

          {/* Status overlays */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {showProcessed && processedFrameSrc && lipBbox && (
              <div className="glass-panel px-2.5 py-1 rounded-full text-xs text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 animate-dot-pulse">
                {Icons.target}
                <span className="font-medium">Lip Tracking</span>
              </div>
            )}
            {isStreaming && (
              <div className="glass-panel px-2.5 py-1 rounded-full text-xs text-white border border-white/10 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-medium">Live</span>
              </div>
            )}
          </div>

          {/* Transcript overlay */}
          {speechHaptic.isPipelineRunning && speechHaptic.transcriptChunks.length > 0 && (
            <div className="absolute bottom-16 left-4 right-16 z-20 pointer-events-none">
              <div className="flex flex-col items-start gap-1">
                {speechHaptic.transcriptChunks.slice(-2).map((chunk, i) => (
                  <div key={i} className="glass-panel px-3 py-1.5 rounded-r-xl rounded-tl-xl border-l-2 border-phonix-copper text-white text-sm shadow-lg">
                    {chunk.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vibration indicator */}
          {haptics.state.isVibrating && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <div className="glass-panel text-phonix-gold text-xs px-4 py-2 rounded-full border border-phonix-copper/30 flex items-center gap-2">
                <div className="w-2 h-2 bg-phonix-gold rounded-full animate-dot-pulse" />
                <span className="font-mono">{haptics.state.feelLabel}</span>
                <span className="text-phonix-copper font-mono">{pitchLabel}</span>
              </div>
            </div>
          )}

          {isStreaming && !processedFrameSrc && status === "connected" && !haptics.state.isVibrating && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <div className="glass-panel text-gray-400 text-xs px-3 py-1.5 rounded-full border border-white/10 animate-pulse">
                Processing frames...
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-gray-600 text-xs">
          <span>Ensure phone and server are on the same network</span>
          <span className="mx-2 text-phonix-copper/40">/</span>
          <span>Face the front camera</span>
          {pitch.isActive && (
            <span className="block mt-1.5 text-phonix-gold">
              Microphone active — speak to feel dynamic haptic vibrations
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
