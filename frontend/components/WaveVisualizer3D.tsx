"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Shader-based flowing wave mesh ──────────────────────────────────────────

const WAVE_VERTEX = `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uFrequency;
  uniform float uSpeed;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 pos = position;

    float wave1 = sin(pos.x * uFrequency + uTime * uSpeed + uPhase) * uAmplitude;
    float wave2 = sin(pos.x * uFrequency * 1.3 + uTime * uSpeed * 0.7 + uPhase * 1.5) * uAmplitude * 0.6;
    float wave3 = sin(pos.x * uFrequency * 2.1 + uTime * uSpeed * 1.2 + uPhase * 0.8) * uAmplitude * 0.3;

    pos.y += wave1 + wave2 + wave3;
    vElevation = (wave1 + wave2 + wave3) / (uAmplitude * 1.9);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WAVE_FRAGMENT = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    float t = vElevation * 0.5 + 0.5;
    vec3 color = mix(uColorA, uColorB, t);
    float alpha = uOpacity * (0.4 + 0.6 * t);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Single wave layer ───────────────────────────────────────────────────────

interface WaveLayerProps {
  colorA: THREE.Color;
  colorB: THREE.Color;
  amplitude: number;
  frequency: number;
  speed: number;
  phase: number;
  opacity: number;
  yOffset: number;
  reactiveAmplitude: number;
}

function WaveLayer({
  colorA,
  colorB,
  amplitude,
  frequency,
  speed,
  phase,
  opacity,
  yOffset,
  reactiveAmplitude,
}: WaveLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: amplitude },
      uFrequency: { value: frequency },
      uSpeed: { value: speed },
      uPhase: { value: phase },
      uColorA: { value: colorA },
      uColorB: { value: colorB },
      uOpacity: { value: opacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    // Smoothly interpolate amplitude toward the reactive target
    const target = amplitude + reactiveAmplitude;
    uniforms.uAmplitude.value += (target - uniforms.uAmplitude.value) * 0.08;
  });

  return (
    <mesh ref={meshRef} position={[0, yOffset, 0]} rotation={[-Math.PI * 0.08, 0, 0]}>
      <planeGeometry args={[12, 1.8, 256, 1]} />
      <shaderMaterial
        vertexShader={WAVE_VERTEX}
        fragmentShader={WAVE_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Particle field for subtle sparkle ────────────────────────────────────────

function ParticleField({ count = 120, reactiveScale = 0 }: { count?: number; reactiveScale?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      speeds[i] = 0.2 + Math.random() * 0.8;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += speeds[i] * delta * (0.3 + reactiveScale * 0.5);
      if (pos[i * 3] > 6) pos[i * 3] = -6;
      pos[i * 3 + 1] += Math.sin(pos[i * 3] * 2) * delta * 0.1;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color="#D4A574"
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ── Scene composition ────────────────────────────────────────────────────────

interface WaveSceneProps {
  /** 0 – 1 reactive intensity (from haptic / phoneme / mouth openness) */
  intensity: number;
  /** Current phoneme type for color shift */
  phonemeType: string | null;
}

function WaveScene({ intensity, phonemeType }: WaveSceneProps) {
  // Theme colors — copper / gold with teal accents
  const copperA = useMemo(() => new THREE.Color("#B87333"), []);
  const copperB = useMemo(() => new THREE.Color("#D4A574"), []);
  const tealA = useMemo(() => new THREE.Color("#2dd4bf"), []);
  const tealB = useMemo(() => new THREE.Color("#38bdf8"), []);

  // Shift palette based on phoneme
  const activeColorA = useMemo(() => {
    if (phonemeType === "vowel") return new THREE.Color("#34d399");
    if (phonemeType === "consonant") return new THREE.Color("#60a5fa");
    if (phonemeType === "buzz") return new THREE.Color("#fbbf24");
    return tealA;
  }, [phonemeType, tealA]);

  const reactive = intensity * 0.6;

  return (
    <>
      {/* Copper/gold primary wave */}
      <WaveLayer
        colorA={copperA}
        colorB={copperB}
        amplitude={0.25}
        frequency={1.6}
        speed={0.6}
        phase={0}
        opacity={0.85}
        yOffset={0}
        reactiveAmplitude={reactive}
      />
      {/* Teal secondary wave */}
      <WaveLayer
        colorA={activeColorA}
        colorB={tealB}
        amplitude={0.2}
        frequency={2.0}
        speed={0.45}
        phase={1.5}
        opacity={0.55}
        yOffset={-0.1}
        reactiveAmplitude={reactive * 0.7}
      />
      {/* Subtle background wave */}
      <WaveLayer
        colorA={copperB}
        colorB={activeColorA}
        amplitude={0.12}
        frequency={2.8}
        speed={0.8}
        phase={3.0}
        opacity={0.3}
        yOffset={0.15}
        reactiveAmplitude={reactive * 0.4}
      />
      <ParticleField reactiveScale={intensity} />
    </>
  );
}

// ── Exported component ───────────────────────────────────────────────────────

export interface WaveVisualizer3DProps {
  /** 0 – 1 reactive intensity */
  intensity?: number;
  /** Current phoneme type (vowel / consonant / buzz / silence) */
  phonemeType?: string | null;
  /** Container height */
  height?: string;
  /** Additional className */
  className?: string;
}

export default function WaveVisualizer3D({
  intensity = 0,
  phonemeType = null,
  height = "180px",
  className = "",
}: WaveVisualizer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Clamp intensity
  const safeIntensity = Math.max(0, Math.min(1, intensity));

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl overflow-hidden ${className}`}
      style={{ height }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <WaveScene intensity={safeIntensity} phonemeType={phonemeType} />
      </Canvas>
    </div>
  );
}
