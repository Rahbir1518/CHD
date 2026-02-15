"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Play,
  ChevronDown,
  Video,
  FileText,
  Zap,
  LayoutDashboard,
  Users,
  Package,
  FlaskConical,
  Twitter,
  Github,
  Linkedin,
} from "lucide-react";

const ParticleBackground = dynamic(
  () => import("@/components/ParticleBackground"),
  { ssr: false }
);

gsap.registerPlugin(ScrollTrigger);

/* ─────────── Slideshow Hook ─────────── */
function useSlideshow(count: number, interval = 4000) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCurrent((p) => (p + 1) % count), interval);
    return () => clearInterval(id);
  }, [count, interval]);
  return { current, setCurrent };
}

/* ═══════════════════════════════════════
   HOMEPAGE
   ═══════════════════════════════════════ */
export default function HomePage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const slideshow = useSlideshow(4);

  // Redirect signed-in users
  useEffect(() => {
    if (isSignedIn) router.replace("/dashboard");
  }, [isSignedIn, router]);

  /* ── GSAP Animations ── */
  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return;
      if (window.scrollY > 100) {
        navRef.current.classList.remove("opacity-0", "-translate-y-full");
        navRef.current.classList.add("opacity-100", "translate-y-0");
      } else {
        navRef.current.classList.add("opacity-0", "-translate-y-full");
        navRef.current.classList.remove("opacity-100", "translate-y-0");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    if (heroContentRef.current) {
      gsap.from(heroContentRef.current.children, {
        opacity: 0,
        y: 50,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
        delay: 0.3,
      });
    }
    if (heroVisualRef.current) {
      gsap.from(heroVisualRef.current, {
        opacity: 0,
        x: 100,
        duration: 1.2,
        ease: "power3.out",
        delay: 0.5,
      });
    }

    gsap.utils.toArray<HTMLElement>(".feature-card").forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        opacity: 0,
        y: 60,
        duration: 0.8,
        delay: i * 0.1,
        ease: "power3.out",
      });
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  /* ── Toast helper ── */
  const toast = useCallback((msg: string) => {
    const el = document.createElement("div");
    el.className =
      "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-[#B87333]/90 text-white rounded-full text-sm font-medium z-50 animate-bounce";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }, []);

  /* ── Smooth scroll ── */
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  if (isSignedIn) return null;

  return (
    <div className="relative bg-[#0a0a0a] text-[#F5F5F5] antialiased overflow-x-hidden">
      {/* Grain */}
      <div className="grain-overlay" />

      {/* Three.js background */}
      <ParticleBackground />

      {/* ═══ NAVIGATION ═══ */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 w-full z-50 transition-all duration-500 opacity-0 -translate-y-full"
      >
        <div className="glass-panel border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B87333] to-[#D4A574] flex items-center justify-center relative overflow-hidden edge-glow">
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                <FlaskConical className="w-5 h-5 text-white relative z-10" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-white group-hover:text-[#D4A574] transition-colors">
                Haptic<span className="text-[#B87333]">Phonix</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {["features", "architecture", "dashboard"].map((s) => (
                <button
                  key={s}
                  onClick={() => scrollTo(s)}
                  className="nav-link text-sm font-medium text-gray-400 hover:text-white transition-colors capitalize"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/signIn"
                className="hidden md:block text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signUp"
                className="px-6 py-2.5 bg-gradient-to-r from-[#B87333] to-[#D4A574] text-white font-semibold text-sm rounded-full hover:shadow-lg hover:shadow-[#B87333]/25 transition-all transform hover:scale-105 edge-glow"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="content-layer max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div ref={heroContentRef} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-[#B87333]/20 edge-glow">
              <span className="w-2 h-2 rounded-full bg-[#B87333] animate-pulse" />
              <span className="text-xs font-medium text-[#D4A574] uppercase tracking-widest">
                AI-Powered Speech Learning
              </span>
            </div>

            <h1 className="font-display font-bold text-5xl md:text-7xl leading-tight glow-text">
              Feel the <span className="gradient-text">Sound</span>.<br />
              Master <span className="text-[#B87333]">Speech</span>.
            </h1>

            <p className="text-lg text-gray-400 max-w-xl leading-relaxed">
              HapticPhonix uses computer vision, AI lip-reading, and haptic
              feedback to create a revolutionary pronunciation learning
              experience. For deaf/hard-of-hearing learners and anyone seeking
              perfect speech.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/signUp"
                className="group px-8 py-4 bg-gradient-to-r from-[#B87333] to-[#D4A574] text-white font-semibold rounded-full hover:shadow-2xl hover:shadow-[#B87333]/30 transition-all transform hover:scale-105 flex items-center gap-2 edge-glow"
              >
                <span>Start Learning</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => toast("Demo coming soon!")}
                className="px-8 py-4 glass-panel text-white font-semibold rounded-full hover:bg-white/5 transition-all flex items-center gap-2 border border-white/10 edge-glow"
              >
                <Play className="w-5 h-5 text-[#D4A574]" />
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/10">
              {[
                { value: "98%", label: "Accuracy" },
                { value: "50+", label: "Phonemes" },
                { value: "8D", label: "Haptic Audio" },
              ].map((s) => (
                <div key={s.label} className="group">
                  <div className="text-3xl font-display font-bold text-white group-hover:text-[#D4A574] transition-colors">
                    {s.value}
                  </div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Phone Mockup */}
          <div
            ref={heroVisualRef}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="relative">
              <div className="relative w-72 h-[580px] bg-gradient-to-b from-gray-800 to-gray-900 rounded-[3rem] border-4 border-gray-700 shadow-2xl overflow-hidden transform rotate-6 hover:rotate-0 transition-transform duration-700 edge-glow">
                <div className="absolute inset-2 bg-black rounded-[2.5rem] overflow-hidden">
                  {/* Slides */}
                  <div className="relative w-full h-full">
                    {/* Slide 0 — Face Mesh */}
                    <div className={`slideshow-slide ${slideshow.current === 0 ? "active" : ""}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#111] to-black">
                        <svg className="absolute inset-0 w-full h-full opacity-50" viewBox="0 0 300 580">
                          <defs>
                            <linearGradient id="meshGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#D4A574" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#B87333" stopOpacity={0.5} />
                            </linearGradient>
                          </defs>
                          <ellipse cx="150" cy="240" rx="85" ry="105" fill="none" stroke="url(#meshGrad1)" strokeWidth="1.5" />
                          <rect x="105" y="270" width="90" height="45" fill="none" stroke="#D4A574" strokeWidth="2" rx="22" />
                          <circle cx="125" cy="292" r="4" fill="#D4A574" className="animate-pulse" />
                          <circle cx="150" cy="302" r="4" fill="#D4A574" className="animate-pulse" style={{ animationDelay: "0.2s" }} />
                          <circle cx="175" cy="292" r="4" fill="#D4A574" className="animate-pulse" style={{ animationDelay: "0.4s" }} />
                          <circle cx="138" cy="280" r="3" fill="#B87333" />
                          <circle cx="162" cy="280" r="3" fill="#B87333" />
                        </svg>
                        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#B87333]/20 border border-[#B87333]/40">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs text-[#D4A574] font-medium">Tracking Active</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Slide 1 — Phoneme Analysis */}
                    <div className={`slideshow-slide ${slideshow.current === 1 ? "active" : ""}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/20 to-black flex flex-col items-center justify-center">
                        <div className="text-7xl font-bold text-[#D4A574] mb-4">/æ/</div>
                        <div className="text-sm text-gray-400 mb-6">Vowel Detected</div>
                        <div className="flex items-end gap-2 h-24">
                          <div className="w-6 bg-[#B87333]/60 rounded-full phoneme-bar" style={{ height: "80%" }} />
                          <div className="w-6 bg-[#B87333]/80 rounded-full phoneme-bar" style={{ height: "45%", animationDelay: "0.1s" }} />
                          <div className="w-6 bg-[#B87333]/60 rounded-full phoneme-bar" style={{ height: "80%", animationDelay: "0.2s" }} />
                        </div>
                        <div className="mt-6 text-xs text-gray-500 font-mono">[100, 50, 100]</div>
                      </div>
                    </div>

                    {/* Slide 2 — Haptic Feedback */}
                    <div className={`slideshow-slide ${slideshow.current === 2 ? "active" : ""}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-black flex items-center justify-center">
                        <div className="relative">
                          <div className="w-36 h-36 rounded-full border-2 border-[#B87333]/50 animate-ping absolute inset-0" />
                          <div className="w-36 h-36 rounded-full bg-[#B87333]/30 flex items-center justify-center relative edge-glow animate-glow">
                            <div className="w-16 h-16 rounded-full bg-[#B87333]/50 animate-vibrate" />
                          </div>
                          <div className="text-center mt-6">
                            <div className="text-lg text-[#D4A574] font-semibold">Haptic Active</div>
                            <div className="text-xs text-gray-400 mt-1">120 Hz Vibration</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Slide 3 — Lip Reading Result */}
                    <div className={`slideshow-slide ${slideshow.current === 3 ? "active" : ""}`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-green-900/10 to-black flex flex-col items-center justify-center px-6">
                        <div className="glass-panel rounded-xl p-4 border border-[#B87333]/30 w-full">
                          <div className="text-xs text-[#D4A574] mb-2 uppercase tracking-wider">Detected Speech</div>
                          <div className="text-white text-lg font-medium leading-relaxed">
                            &quot;Hello, I am practicing my pronunciation&quot;
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <div className="h-1.5 flex-1 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full w-[98%] bg-gradient-to-r from-[#B87333] to-[#D4A574] rounded-full" />
                            </div>
                            <span className="text-xs text-[#D4A574] font-mono">98%</span>
                          </div>
                        </div>
                        <div className="mt-6 flex gap-2">
                          {["/h/", "/ə/", "/l/", "/oʊ/"].map((p) => (
                            <span key={p} className="px-3 py-1 bg-[#B87333]/20 rounded-full text-xs text-[#D4A574]">{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slide indicators */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {[0, 1, 2, 3].map((i) => (
                      <button
                        key={i}
                        onClick={() => slideshow.setCurrent(i)}
                        className={`w-2 h-2 rounded-full transition-all ${slideshow.current === i ? "bg-[#B87333]" : "bg-white/30"}`}
                      />
                    ))}
                  </div>

                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-10" />
                </div>

                {/* Side button */}
                <div className="absolute right-[-4px] top-32 w-1 h-16 bg-gray-600 rounded-l" />
              </div>

              {/* Glow effects */}
              <div className="absolute -inset-8 pointer-events-none">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#B87333]/20 blur-3xl animate-glow" />
                <div className="absolute bottom-10 left-0 w-40 h-40 rounded-full bg-[#D4A574]/10 blur-3xl animate-glow" style={{ animationDelay: "1s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 content-layer scroll-indicator">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2 edge-glow">
            <ChevronDown className="w-3 h-3 text-[#B87333] animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE BANNER ═══ */}
      <section className="relative py-8 overflow-hidden border-y border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="marquee-container">
          <div className="marquee-content flex items-center gap-8">
            {["8D HAPTICS", "REAL-TIME PROCESSING", "LIP READING AI", "8D HAPTICS", "REAL-TIME PROCESSING", "LIP READING AI"].map((text, i) => (
              <span key={i} className="contents">
                <span className="text-6xl md:text-8xl font-display font-bold metallic-text tracking-tighter whitespace-nowrap">{text}</span>
                <span className="text-4xl text-[#B87333]/50">///</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ARCHITECTURE ═══ */}
      <section id="architecture" className="relative py-24 overflow-hidden">
        <div className="content-layer max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B87333]/10 border border-[#B87333]/20 text-[#D4A574] text-xs font-medium uppercase tracking-wider mb-6">
              System Design
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl mb-6 glow-text">
              CHD <span className="gradient-text">Architecture</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Real-time speech and lip-reading learning platform with haptic feedback. Supports teacher/student modes and remote lesson delivery.
            </p>
          </div>

          {/* Architecture SVG */}
          <div className="relative max-w-6xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#B87333]/10 via-[#D4A574]/10 to-[#B87333]/10 rounded-3xl blur-2xl opacity-50" />
            <div className="relative glass-panel rounded-2xl p-8 border border-white/10">
              <svg className="w-full" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="frontendGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4A574" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#B87333" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="backendGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="apiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.1} />
                  </linearGradient>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="rgba(212,165,116,0.6)" />
                  </marker>
                </defs>

                {/* Frontend Layer */}
                <rect x="20" y="20" width="960" height="160" rx="12" fill="url(#frontendGrad)" stroke="rgba(212,165,116,0.3)" strokeWidth="2"/>
                <text x="50" y="50" fill="#D4A574" fontSize="12" fontWeight="600" fontFamily="Space Grotesk,sans-serif">FRONTEND (Next.js 16 + React 19)</text>

                {[
                  { x: 50, label: "Dashboard", sub: "Viewer & Controls", ws: "/ws/viewer" },
                  { x: 280, label: "Teacher", sub: "Lesson Controls", ws: "/ws/viewer" },
                  { x: 510, label: "Student", sub: "Camera + Haptics", ws: "/ws/video" },
                  { x: 740, label: "Speech-Haptic", sub: "Phone UI", ws: "/ws/speech-haptic" },
                ].map((c) => (
                  <g key={c.label}>
                    <rect x={c.x} y="70" width="200" height="90" rx="8" fill="rgba(26,26,26,0.9)" stroke="rgba(212,165,116,0.4)" strokeWidth="1"/>
                    <text x={c.x + 100} y="95" fill="#F5F5F5" fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="Inter,sans-serif">{c.label}</text>
                    <text x={c.x + 100} y="115" fill="#9CA3AF" fontSize="9" textAnchor="middle" fontFamily="Inter,sans-serif">{c.sub}</text>
                    <text x={c.x + 100} y="130" fill="#9CA3AF" fontSize="9" textAnchor="middle" fontFamily="Inter,sans-serif">{c.ws}</text>
                  </g>
                ))}

                {[150, 380, 610, 840].map((x) => (
                  <line key={x} x1={x} y1="160" x2={x} y2="210" stroke="rgba(212,165,116,0.4)" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)"/>
                ))}

                {/* Backend Layer */}
                <rect x="20" y="210" width="960" height="280" rx="12" fill="url(#backendGrad)" stroke="rgba(59,130,246,0.3)" strokeWidth="2"/>
                <text x="50" y="240" fill="#60A5FA" fontSize="12" fontWeight="600" fontFamily="Space Grotesk,sans-serif">BACKEND (FastAPI + Python)</text>

                <rect x="50" y="260" width="920" height="50" rx="8" fill="rgba(17,17,17,0.9)" stroke="rgba(139,92,246,0.4)" strokeWidth="1"/>
                <text x="70" y="280" fill="#A78BFA" fontSize="10" fontWeight="600" fontFamily="Inter,sans-serif">WebSocket Managers:</text>
                <text x="220" y="280" fill="#9CA3AF" fontSize="9" fontFamily="Inter,sans-serif">ConnectionManager | ViewerManager | HapticManager | SpeechHapticConnectionManager</text>

                {[
                  { x: 50, title: "MediaPipe", sub: "Face Mesh Processor", items: ["Lip Landmarks", "Bounding Box", "Mouth State", "face_landmarker.task"], color: "#60A5FA", stroke: "rgba(59,130,246,0.4)" },
                  { x: 290, title: "Lip Reading", sub: "Gemini Vision Engine", items: ["Text Extraction", "Confidence Score", "Phoneme Detection", "Gemini 2.0 Flash"], color: "#D4A574", stroke: "rgba(212,165,116,0.4)" },
                  { x: 530, title: "Phoneme Engine", sub: "Lesson Playback", items: ["JSON Lessons", "Timing Control", "Haptic Triggers", "/playback/start|pause|stop"], color: "#34D399", stroke: "rgba(16,185,129,0.4)" },
                  { x: 770, title: "Speech-Haptic", sub: "Pipeline", items: ["Mic Capture", "ElevenLabs STT", "RMS → Haptic", "/api/speech-haptic/*"], color: "#A78BFA", stroke: "rgba(139,92,246,0.4)" },
                ].map((e) => (
                  <g key={e.title}>
                    <rect x={e.x} y="330" width={e.x === 770 ? 200 : 210} height="140" rx="8" fill="rgba(26,26,26,0.9)" stroke={e.stroke} strokeWidth="1"/>
                    <text x={e.x + (e.x === 770 ? 100 : 105)} y="355" fill={e.color} fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="Inter,sans-serif">{e.title}</text>
                    <text x={e.x + (e.x === 770 ? 100 : 105)} y="375" fill="#9CA3AF" fontSize="9" textAnchor="middle" fontFamily="Inter,sans-serif">{e.sub}</text>
                    {e.items.map((item, idx) => (
                      <text key={idx} x={e.x + (e.x === 770 ? 100 : 105)} y={395 + idx * 15} fill="#6B7280" fontSize="8" textAnchor="middle" fontFamily="Inter,sans-serif">• {item}</text>
                    ))}
                  </g>
                ))}

                {[155, 395, 870].map((x) => (
                  <line key={x} x1={x} y1="470" x2={x} y2="520" stroke="rgba(16,185,129,0.4)" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrowhead)"/>
                ))}

                {/* External APIs */}
                <rect x="20" y="520" width="960" height="160" rx="12" fill="url(#apiGrad)" stroke="rgba(16,185,129,0.3)" strokeWidth="2"/>
                <text x="50" y="550" fill="#34D399" fontSize="12" fontWeight="600" fontFamily="Space Grotesk,sans-serif">EXTERNAL APIs</text>

                {[
                  { x: 50, w: 280, title: "MediaPipe Model", sub: "face_landmarker.task", desc: "Real-time face mesh & lip detection", color: "#34D399", stroke: "rgba(16,185,129,0.4)" },
                  { x: 360, w: 280, title: "Google Gemini API", sub: "Vision + Translation", desc: "Lip reading & multilingual support", color: "#D4A574", stroke: "rgba(212,165,116,0.4)" },
                  { x: 670, w: 280, title: "ElevenLabs API", sub: "STT + TTS", desc: "scribe_v2 | Voice cues & transcription", color: "#A78BFA", stroke: "rgba(139,92,246,0.4)" },
                ].map((api) => (
                  <g key={api.title}>
                    <rect x={api.x} y="570" width={api.w} height="90" rx="8" fill="rgba(26,26,26,0.9)" stroke={api.stroke} strokeWidth="1"/>
                    <text x={api.x + api.w / 2} y="595" fill={api.color} fontSize="11" fontWeight="600" textAnchor="middle" fontFamily="Inter,sans-serif">{api.title}</text>
                    <text x={api.x + api.w / 2} y="615" fill="#9CA3AF" fontSize="9" textAnchor="middle" fontFamily="Inter,sans-serif">{api.sub}</text>
                    <text x={api.x + api.w / 2} y="635" fill="#6B7280" fontSize="8" textAnchor="middle" fontFamily="Inter,sans-serif">{api.desc}</text>
                  </g>
                ))}

                <text x="170" y="195" fill="#D4A574" fontSize="8" fontFamily="Inter,sans-serif">ws/viewer</text>
                <text x="400" y="195" fill="#D4A574" fontSize="8" fontFamily="Inter,sans-serif">ws/viewer</text>
                <text x="625" y="195" fill="#D4A574" fontSize="8" fontFamily="Inter,sans-serif">ws/video</text>
                <text x="855" y="195" fill="#D4A574" fontSize="8" fontFamily="Inter,sans-serif">ws/speech-haptic</text>
              </svg>

              <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#B87333]/40 border border-[#B87333]" />
                  <span className="text-gray-400">Frontend (Next.js)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500/40 border border-blue-500" />
                  <span className="text-gray-400">Backend (FastAPI)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500/40 border border-green-500" />
                  <span className="text-gray-400">External APIs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-0.5 border-t border-dashed border-[#B87333]/60" />
                  <span className="text-gray-400">WebSocket Connection</span>
                </div>
              </div>
            </div>
          </div>

          {/* Data Flow Cards */}
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: <Video className="w-5 h-5 text-[#B87333]" />, bg: "bg-[#B87333]/20", title: "Video Pipeline", desc: "Student phone captures camera → MediaPipe Face Mesh → lip landmarks → broadcast to viewers with bounding boxes" },
              { icon: <FileText className="w-5 h-5 text-blue-400" />, bg: "bg-blue-500/20", title: "Lip Reading", desc: "Cropped lip frames → Gemini Vision every 3s → text, confidence, phonemes → broadcast to dashboard" },
              { icon: <Zap className="w-5 h-5 text-purple-400" />, bg: "bg-purple-500/20", title: "Speech-Haptic", desc: "Teacher mic → ElevenLabs STT → speech chunks → RMS intensity → haptic events → student phone vibration" },
            ].map((card) => (
              <div key={card.title} className="feature-card rounded-xl p-6">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-4`}>
                  {card.icon}
                </div>
                <h4 className="font-semibold text-white mb-2">{card.title}</h4>
                <p className="text-sm text-gray-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="relative py-32">
        <div className="content-layer max-w-7xl mx-auto px-6">
          {/* Lip Reading Feature */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B87333]/10 border border-[#B87333]/20 text-[#D4A574] text-xs font-medium uppercase tracking-wider edge-glow">
                Lip Reading AI
              </div>
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-tight glow-text">
                See What You <span className="text-[#B87333]">Say</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Our Gemini 2.0 Flash Vision integration analyzes lip movements in real-time, converting visual speech into text with 98% accuracy. The AI detects phonemes, confidence scores, and mouth states instantly.
              </p>
              <ul className="space-y-4">
                {[
                  "Real-time lip landmark detection with MediaPipe",
                  "Gemini 2.0 Flash Vision for text extraction",
                  "Mouth state detection: closed, open, talking",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#B87333]/20 flex items-center justify-center flex-shrink-0 mt-0.5 edge-glow">
                      <svg className="w-3 h-3 text-[#B87333]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#B87333]/20 to-[#D4A574]/20 rounded-3xl blur-3xl animate-glow" />
              <div className="relative glass-panel rounded-3xl p-8 border border-white/10 edge-glow">
                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300">
                      <defs>
                        <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#D4A574" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#B87333" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <ellipse cx="200" cy="150" rx="100" ry="120" fill="none" stroke="url(#faceGrad)" strokeWidth="1.5" opacity="0.6"/>
                      <rect x="150" y="180" width="100" height="50" rx="25" fill="none" stroke="#D4A574" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse"/>
                      <circle cx="160" cy="200" r="4" fill="#D4A574"><animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/></circle>
                      <circle cx="200" cy="210" r="4" fill="#D4A574"><animate attributeName="opacity" values="1;0.5;1" dur="2s" begin="0.3s" repeatCount="indefinite"/></circle>
                      <circle cx="240" cy="200" r="4" fill="#D4A574"><animate attributeName="opacity" values="1;0.5;1" dur="2s" begin="0.6s" repeatCount="indefinite"/></circle>
                      <circle cx="180" cy="190" r="3" fill="#B87333"/>
                      <circle cx="220" cy="190" r="3" fill="#B87333"/>
                    </svg>
                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/10 edge-glow">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-mono text-gray-300">LIP_READING_ACTIVE</span>
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="glass-panel rounded-lg p-3 border border-[#B87333]/30 edge-glow">
                        <div className="text-xs text-[#D4A574] mb-1">Detected:</div>
                        <div className="text-white font-mono text-sm">&quot;Hello, I am practicing my pronunciation&quot;</div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full w-[98%] bg-gradient-to-r from-[#B87333] to-[#D4A574] rounded-full" />
                          </div>
                          <span className="text-xs text-[#D4A574]">98%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Haptic Feature */}
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-32">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl animate-glow" style={{ animationDelay: "0.5s" }} />
              <div className="relative glass-panel rounded-3xl p-8 border border-white/10 edge-glow">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { sym: "/æ/", name: "Cat vowel", bars: [80, 40, 80], color: "bg-[#B87333]", code: "[100,50,100]" },
                    { sym: "/t/", name: "Stop consonant", bars: [100, 20], color: "bg-blue-500", code: "[50,30]" },
                    { sym: "/z/", name: "Buzz fricative", bars: [60, 60, 60, 60], color: "bg-purple-500", code: "[30,30,30,30]" },
                  ].map((p) => (
                    <div key={p.sym} className="bg-black/40 rounded-xl p-4 border border-white/5 hover:border-[#B87333]/50 transition-colors group edge-glow">
                      <div className="text-[#D4A574] text-2xl font-bold mb-2">{p.sym}</div>
                      <div className="text-xs text-gray-500 mb-3">{p.name}</div>
                      <div className="flex items-end gap-1 h-12">
                        {p.bars.map((h, i) => (
                          <div key={i} className={`flex-1 ${p.color}/60 rounded-t phoneme-bar`} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                        ))}
                      </div>
                      <div className="mt-2 text-[10px] text-gray-600 font-mono">{p.code}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-black/40 rounded-xl border border-white/5 edge-glow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Laryngeal Haptics</span>
                    <span className="text-xs text-[#D4A574]">Active</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-16 bg-gray-900 rounded-lg overflow-hidden relative edge-glow">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-px bg-[#B87333]/30" />
                      </div>
                      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <path d="M0,32 Q50,10 100,32 T200,32 T300,32 T400,32" stroke="#D4A574" strokeWidth="2" fill="none" className="animate-pulse">
                          <animate attributeName="d" values="M0,32 Q50,10 100,32 T200,32 T300,32 T400,32;M0,32 Q50,54 100,32 T200,32 T300,32 T400,32;M0,32 Q50,10 100,32 T200,32 T300,32 T400,32" dur="2s" repeatCount="indefinite"/>
                        </path>
                      </svg>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">120<span className="text-sm text-gray-500">Hz</span></div>
                      <div className="text-xs text-gray-500">Pitch detected</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium uppercase tracking-wider edge-glow">
                8D Haptic Engine
              </div>
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-tight glow-text">
                Feel Every <span className="text-[#B87333]">Phoneme</span>
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                Our proprietary haptic engine translates speech into tactile feedback. Vowels buzz long, consonants tap short, and pitch becomes throat vibration. Feel the difference between /æ/ and /ɑ/ through your fingertips.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-panel rounded-xl p-4 border border-white/5 edge-glow">
                  <div className="text-[#D4A574] font-bold text-3xl mb-1">50+</div>
                  <div className="text-sm text-gray-400">Unique haptic patterns</div>
                </div>
                <div className="glass-panel rounded-xl p-4 border border-white/5 edge-glow">
                  <div className="text-[#D4A574] font-bold text-3xl mb-1">20Hz</div>
                  <div className="text-sm text-gray-400">Update frequency</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DASHBOARD PREVIEW ═══ */}
      <section id="dashboard" className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#B87333]/5 to-transparent" />
        <div className="content-layer max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display font-bold text-4xl md:text-5xl mb-6 glow-text">
              Teacher <span className="gradient-text">Dashboard</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Real-time monitoring, lesson control, and AI-powered insights for educators.
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#B87333]/20 via-[#D4A574]/20 to-[#B87333]/20 rounded-3xl blur-2xl opacity-50" />
            <div className="relative glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl edge-glow">
              <div className="bg-gray-900 border-b border-white/5 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-black/50 rounded-md px-3 py-1.5 text-xs text-gray-500 text-center font-mono">localhost:3000/dashboard</div>
                </div>
              </div>

              <div className="bg-gray-950 p-6 grid grid-cols-12 gap-4 min-h-[600px]">
                <div className="col-span-2 space-y-2">
                  {[
                    { icon: <LayoutDashboard className="w-4 h-4" />, label: "Overview", active: true },
                    { icon: <Users className="w-4 h-4" />, label: "Students", active: false },
                    { icon: <Package className="w-4 h-4" />, label: "Lessons", active: false },
                  ].map((item) => (
                    <div key={item.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.active ? "bg-[#B87333]/20 text-[#D4A574]" : "text-gray-400 hover:bg-white/5"} transition-colors`}>
                      {item.icon}
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="col-span-7 space-y-4">
                  <div className="bg-black rounded-xl overflow-hidden border border-white/10 relative aspect-video">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-[#B87333]/20 flex items-center justify-center mx-auto mb-2 animate-pulse">
                          <Video className="w-8 h-8 text-[#B87333]" />
                        </div>
                        <span className="text-sm text-gray-500">Live Feed Active</span>
                      </div>
                    </div>
                    <div className="absolute top-4 left-4 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-[10px] text-green-400 font-mono">LIVE</div>
                    <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 backdrop-blur rounded border border-white/10 text-[10px] text-gray-400">Latency: 24ms</div>
                  </div>

                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">Phoneme Timeline</span>
                    </div>
                    <div className="h-12 flex items-end gap-1">
                      {[40, 60, 80, 100, 50, 70, 45, 55].map((h, i) => (
                        <div key={i} className={`flex-1 rounded-t phoneme-bar ${i === 4 ? "bg-blue-500/50" : i === 6 ? "bg-purple-500/50" : "bg-[#B87333]/60"}`} style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono">
                      <span>0:00</span><span>0:02</span><span>0:04</span><span>0:06</span><span>0:08</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 space-y-4">
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Student Progress</div>
                    <div className="space-y-3">
                      {[
                        { label: "Accuracy", value: 87, gradient: "from-[#B87333] to-[#D4A574]" },
                        { label: "Fluency", value: 72, gradient: "from-blue-500 to-purple-500" },
                        { label: "Confidence", value: 91, gradient: "from-green-500 to-emerald-500" },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-300">{stat.label}</span>
                            <span className="text-[#D4A574]">{stat.value}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${stat.gradient} rounded-full`} style={{ width: `${stat.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Recent Phonemes</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { p: "/æ/", cls: "bg-[#B87333]/20 text-[#D4A574]" },
                        { p: "/t/", cls: "bg-blue-500/20 text-blue-400" },
                        { p: "/z/", cls: "bg-purple-500/20 text-purple-400" },
                        { p: "/i/", cls: "bg-green-500/20 text-green-400" },
                        { p: "/th/", cls: "bg-[#B87333]/20 text-[#D4A574]" },
                      ].map((ph) => (
                        <span key={ph.p} className={`px-2 py-1 ${ph.cls} rounded text-xs font-mono`}>{ph.p}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#B87333]/20 to-[#D4A574]/20 rounded-xl p-4 border border-[#B87333]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-[#D4A574]" />
                      <span className="text-xs font-medium text-[#D4A574]">AI Insight</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Student shows improvement in vowel pronunciation. Recommend practicing /æ/ vs /ɑ/ distinction.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#B87333]/10 via-transparent to-[#D4A574]/10" />
        <div className="content-layer max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-5xl md:text-6xl mb-6 glow-text">
            Ready to <span className="gradient-text">Feel</span> the Difference?
          </h2>
          <p className="text-xl text-gray-400 mb-10 leading-relaxed">
            Join thousands of learners and educators transforming speech therapy with AI-powered haptic feedback.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signUp" className="px-10 py-5 bg-gradient-to-r from-[#B87333] to-[#D4A574] text-white font-semibold rounded-full hover:shadow-2xl hover:shadow-[#B87333]/30 transition-all transform hover:scale-105 edge-glow">
              Start Free Trial
            </Link>
            <button onClick={() => toast("Contact form coming soon!")} className="px-10 py-5 glass-panel text-white font-semibold rounded-full hover:bg-white/5 transition-all border border-white/10 edge-glow">
              Contact Sales
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative py-16 border-t border-white/5">
        <div className="content-layer max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#B87333] to-[#D4A574] flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-bold text-xl text-white">
                  Haptic<span className="text-[#B87333]">Phonix</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Revolutionary speech learning through AI lip-reading and haptic feedback technology.
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "API", "Integrations"] },
              { title: "Resources", links: ["Documentation", "Tutorials", "Blog", "Support"] },
              { title: "Company", links: ["About", "Careers", "Privacy", "Terms"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-white mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button onClick={() => toast("Coming soon!")} className="text-sm text-gray-400 hover:text-[#D4A574] transition-colors">
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">© 2025 HapticPhonix. All rights reserved.</p>
            <div className="flex gap-4">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <button key={i} onClick={() => toast("Coming soon!")} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#B87333]/20 transition-colors">
                  <Icon className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}