"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { starVertexShader, starFragmentShader } from "./PersonaShaders";

interface StarFieldProps {
  count?: number;
  radius?: number;
  color?: string;
}

export function StarField({ count = 500, radius = 10, color = "#88ccff" }: StarFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, brightnesses } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightnesses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute stars in a sphere around the scene
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.5 + Math.random() * 0.5);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Random sizes (smaller stars are more common)
      sizes[i] = Math.random() * Math.random() * 3 + 0.5;

      // Random brightness
      brightnesses[i] = 0.3 + Math.random() * 0.7;
    }

    return { positions, sizes, brightnesses };
  }, [count, radius]);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      color: { value: new THREE.Color(color) },
    }),
    [color]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }

    // Slowly rotate the star field
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
        <bufferAttribute
          attach="attributes-brightness"
          args={[brightnesses, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={starVertexShader}
        fragmentShader={starFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Floating dust particles closer to the persona
export function DustParticles({ count = 100, color = "#00ffcc" }: { count?: number; color?: string }) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 3;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      const time = clock.getElapsedTime();
      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        // Gentle floating motion
        arr[i * 3 + 1] += Math.sin(time + i) * 0.0005;

        // Wrap particles that go too far
        if (arr[i * 3 + 1] > 1.5) arr[i * 3 + 1] = -1.5;
        if (arr[i * 3 + 1] < -1.5) arr[i * 3 + 1] = 1.5;
      }

      posAttr.needsUpdate = true;
    }
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
        size={0.02}
        color={color}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
