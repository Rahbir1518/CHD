"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const frameCountRef = useRef(0);
  const { camera } = useThree();

  const particleCount = 150;
  const connectionDistance = 1.5;
  const maxConnections = 3;

  const { positions, velocities, originalPositions } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vels: { x: number; y: number; z: number }[] = [];
    const origPos: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const radius = 3 + Math.random() * 4;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      origPos.push({ x, y, z });
      vels.push({
        x: (Math.random() - 0.5) * 0.002,
        y: (Math.random() - 0.5) * 0.002,
        z: (Math.random() - 0.5) * 0.002,
      });
    }

    return { positions: pos, velocities: vels, originalPositions: origPos };
  }, []);

  const linePositions = useMemo(
    () => new Float32Array(particleCount * particleCount * 6),
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.targetX =
          (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouseRef.current.targetY =
          -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  useFrame(() => {
    if (!pointsRef.current || !linesRef.current) return;
    frameCountRef.current++;

    const mouse = mouseRef.current;
    mouse.x += (mouse.targetX - mouse.x) * 0.03;
    mouse.y += (mouse.targetY - mouse.y) * 0.03;

    pointsRef.current.rotation.y += 0.0005;
    pointsRef.current.rotation.x += 0.0002;

    const posArray = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    let lineIndex = 0;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      posArray[i3] += velocities[i].x;
      posArray[i3 + 1] += velocities[i].y;
      posArray[i3 + 2] += velocities[i].z;

      const mouseInfluenceX = mouse.x * 0.3;
      const mouseInfluenceY = mouse.y * 0.3;

      posArray[i3] +=
        (originalPositions[i].x + mouseInfluenceX - posArray[i3]) * 0.01;
      posArray[i3 + 1] +=
        (originalPositions[i].y + mouseInfluenceY - posArray[i3 + 1]) * 0.01;
      posArray[i3 + 2] +=
        (originalPositions[i].z - posArray[i3 + 2]) * 0.01;

      if (frameCountRef.current % 2 === 0) {
        let connections = 0;
        for (
          let j = i + 1;
          j < particleCount && connections < maxConnections;
          j++
        ) {
          const j3 = j * 3;
          const dx = posArray[i3] - posArray[j3];
          const dy = posArray[i3 + 1] - posArray[j3 + 1];
          const dz = posArray[i3 + 2] - posArray[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDistance) {
            linePositions[lineIndex++] = posArray[i3];
            linePositions[lineIndex++] = posArray[i3 + 1];
            linePositions[lineIndex++] = posArray[i3 + 2];
            linePositions[lineIndex++] = posArray[j3];
            linePositions[lineIndex++] = posArray[j3 + 1];
            linePositions[lineIndex++] = posArray[j3 + 2];
            connections++;
          }
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    if (frameCountRef.current % 2 === 0) {
      linesRef.current.geometry.setDrawRange(0, lineIndex / 3);
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 0.5 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={particleCount}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={0xd4a574}
          size={0.05}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
            count={particleCount * particleCount * 2}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0xb87333} transparent opacity={0.15} />
      </lineSegments>
    </>
  );
}

export default function ParticleBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 75 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <Particles />
      </Canvas>
    </div>
  );
}
