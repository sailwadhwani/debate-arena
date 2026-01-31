"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTheme } from "@/contexts/ThemeContext";

interface ParticleBackgroundProps {
  /** Number of background particles */
  particleCount?: number;
  /** Whether mouse interaction is enabled */
  interactive?: boolean;
  /** Intensity of the particle effect (0-1) */
  intensity?: number;
  /** Whether this is a subtle background (reduced motion) */
  subtle?: boolean;
}

// Background particle system
function BackgroundParticles({
  count,
  interactive,
  intensity,
  subtle,
}: {
  count: number;
  interactive: boolean;
  intensity: number;
  subtle: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const mouseRef = useRef(new THREE.Vector2(-100, -100));
  const { resolvedTheme } = useTheme();
  const { camera } = useThree();

  // Theme-aware colors
  const colors = useMemo(() => {
    const isDark = resolvedTheme === "dark";
    return {
      primary: isDark ? 0x00ddff : 0x0284c7,
      secondary: isDark ? 0x4488ff : 0x0369a1,
      ambient: isDark ? 0x2244ff : 0x64748b,
    };
  }, [resolvedTheme]);

  // Geometry with positions and attributes
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Spread particles across a large area
      positions[i * 3] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 20;

      // Random velocities for floating
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;

      sizes[i] = Math.random() * 2 + 0.5;

      // Gradient from primary to secondary color based on position
      const t = Math.random();
      colors[i * 3] = t;
      colors[i * 3 + 1] = 0.5 + t * 0.5;
      colors[i * 3 + 2] = 1.0;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    return geo;
  }, [count]);

  // Mouse tracking
  useEffect(() => {
    if (!interactive) return;

    const handlePointerMove = (e: PointerEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerLeave = () => {
      mouseRef.current.set(-100, -100);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [interactive]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const velocities = pointsRef.current.geometry.attributes.velocity.array as Float32Array;
    const time = clock.elapsedTime;
    const speed = subtle ? 0.3 : 1;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Apply velocity with speed modifier
      positions[i3] += velocities[i3] * speed * intensity;
      positions[i3 + 1] += velocities[i3 + 1] * speed * intensity;
      positions[i3 + 2] += velocities[i3 + 2] * speed * intensity;

      // Add gentle wave motion
      positions[i3] += Math.sin(time * 0.2 + i * 0.1) * 0.005 * intensity;
      positions[i3 + 1] += Math.cos(time * 0.15 + i * 0.05) * 0.005 * intensity;

      // Wrap around boundaries
      if (positions[i3] > 75) positions[i3] = -75;
      if (positions[i3] < -75) positions[i3] = 75;
      if (positions[i3 + 1] > 50) positions[i3 + 1] = -50;
      if (positions[i3 + 1] < -50) positions[i3 + 1] = 50;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={1.5}
        color={colors.primary}
        transparent
        opacity={0.4 * intensity}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Ambient glow particles (larger, softer)
function AmbientGlow({ count, intensity }: { count: number; intensity: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { resolvedTheme } = useTheme();

  const color = resolvedTheme === "dark" ? 0x4488ff : 0x64748b;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 40;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = clock.elapsedTime * 0.05;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3 + 1] += Math.sin(time + i * 0.1) * 0.01;
      positions[i3] += Math.cos(time + i * 0.05) * 0.005;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={4}
        color={color}
        transparent
        opacity={0.15 * intensity}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Scene container
function Scene({
  particleCount,
  interactive,
  intensity,
  subtle,
}: {
  particleCount: number;
  interactive: boolean;
  intensity: number;
  subtle: boolean;
}) {
  return (
    <>
      <BackgroundParticles
        count={particleCount}
        interactive={interactive}
        intensity={intensity}
        subtle={subtle}
      />
      <AmbientGlow count={Math.floor(particleCount / 5)} intensity={intensity} />
    </>
  );
}

export function ParticleBackground({
  particleCount = 200,
  interactive = false,
  intensity = 1,
  subtle = false,
}: ParticleBackgroundProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const bgColor = resolvedTheme === "dark" ? "#030014" : "#e8f4fc";

  return (
    <div className={`particle-bg-container ${interactive ? "interactive" : ""}`}>
      <Canvas
        camera={{ position: [0, 0, 50], fov: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "default" }}
        dpr={[1, 1.5]}
        style={{ background: bgColor }}
      >
        <Scene
          particleCount={particleCount}
          interactive={interactive}
          intensity={intensity}
          subtle={subtle}
        />
      </Canvas>
    </div>
  );
}
