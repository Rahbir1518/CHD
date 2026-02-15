"use client";

import { SignUp } from "@clerk/nextjs";
import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ── Ambient Particle Ring ── */
function SignUpParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const { camera } = useThree();

  const count = 140;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 2.5 + Math.random() * 5.5;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.ty = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const m = mouseRef.current;
    m.x += (m.tx - m.x) * 0.03;
    m.y += (m.ty - m.y) * 0.03;
    pointsRef.current.rotation.y += 0.0005;
    pointsRef.current.rotation.x += 0.0002;
    camera.position.x += (m.x * 0.4 - camera.position.x) * 0.02;
    camera.position.y += (m.y * 0.4 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={0xb87333}
        size={0.055}
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function SignUpPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    }
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {/* Grain */}
      <div className="grain-overlay" />

      {/* Three.js background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 8], fov: 75 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
          <SignUpParticles />
        </Canvas>
      </div>

      {/* Ambient glow orbs */}
      <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full bg-phonix-copper/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full bg-phonix-gold/8 blur-[100px] pointer-events-none" />

      {/* Content */}
      <div
        ref={containerRef}
        className="content-layer flex flex-col items-center gap-8 px-4 py-12 transition-all duration-1000 ease-out"
        style={{ opacity: 0, transform: "translateY(24px)" }}
      >
        {/* Brand mark */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-phonix-copper to-phonix-gold flex items-center justify-center relative overflow-hidden edge-glow">
            <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ animationDuration: "4s" }} />
            <svg className="w-5 h-5 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white group-hover:text-phonix-gold transition-colors">
            Haptic<span className="text-phonix-copper">Phonix</span>
          </span>
        </a>

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="font-display font-bold text-2xl md:text-3xl text-white glow-text">
            Begin Your Journey
          </h1>
          <p className="text-sm text-gray-500">Create an account to unlock AI-powered speech learning</p>
        </div>

        {/* Clerk Sign Up card */}
        <div className="glass-panel rounded-2xl p-1 border border-white/10 edge-glow">
          <SignUp
            afterSignUpUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none border-none",
                headerTitle: "text-white font-display",
                headerSubtitle: "text-gray-400",
                formButtonPrimary:
                  "bg-gradient-to-r from-[#B87333] to-[#D4A574] hover:shadow-lg hover:shadow-[#B87333]/25 transition-all text-white font-semibold",
                formFieldInput:
                  "bg-[#111] border border-white/10 text-white placeholder:text-gray-600 focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/40",
                formFieldLabel: "text-gray-400",
                footerActionLink: "text-[#D4A574] hover:text-[#B87333]",
                identityPreviewEditButton: "text-[#D4A574] hover:text-[#B87333]",
                socialButtonsBlockButton:
                  "bg-[#111] border border-white/10 text-gray-300 hover:border-[#B87333]/40 hover:bg-[#1a1a1a] transition-all",
                socialButtonsBlockButtonText: "text-gray-300",
                dividerLine: "bg-white/10",
                dividerText: "text-gray-600",
                footer: "hidden",
              },
            }}
          />
        </div>

        {/* Footer link */}
        <p className="text-xs text-gray-600">
          Already have an account?{" "}
          <a href="/signIn" className="text-phonix-gold hover:text-white transition-colors font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}