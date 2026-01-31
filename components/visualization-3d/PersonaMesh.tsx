"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  humanoidVertexShader,
  humanoidFragmentShader,
  orbVertexShader,
  orbFragmentShader,
} from "./PersonaShaders";

interface PersonaMeshProps {
  color?: string;
  position?: [number, number, number];
  isSpeaking?: boolean;
  speakingIntensity?: number;
}

// Floating orb component
function FloatingOrb({
  position,
  color,
  size,
  speed,
  offset,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  speed: number;
  offset: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color(color) },
      time: { value: 0 },
      intensity: { value: 1.0 },
    }),
    [color]
  );

  useFrame(({ clock }) => {
    if (meshRef.current && materialRef.current) {
      const t = clock.getElapsedTime() * speed + offset;

      // Orbital motion
      meshRef.current.position.x = position[0] + Math.sin(t) * 0.3;
      meshRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.2;
      meshRef.current.position.z = position[2] + Math.cos(t) * 0.3;

      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={orbVertexShader}
        fragmentShader={orbFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function PersonaMesh({
  color = "#00ffcc",
  position = [0, 0, 0],
  isSpeaking = false,
  speakingIntensity = 0,
}: PersonaMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const neckMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const shoulderMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const baseColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.3), [color]);
  const glowColor = useMemo(() => new THREE.Color(color), [color]);

  // Create uniforms for all materials
  const createUniforms = useMemo(
    () => ({
      baseColor: { value: baseColor },
      glowColor: { value: glowColor },
      time: { value: 0 },
      opacity: { value: 0.9 },
      speakingIntensity: { value: 0 },
      pulseIntensity: { value: 1.0 },
      gridDensity: { value: 40.0 },
    }),
    [baseColor, glowColor]
  );

  // Clone uniforms for each material
  const headUniforms = useMemo(() => ({ ...createUniforms }), [createUniforms]);
  const neckUniforms = useMemo(
    () => ({
      ...createUniforms,
      gridDensity: { value: 30.0 },
    }),
    [createUniforms]
  );
  const shoulderUniforms = useMemo(
    () => ({
      ...createUniforms,
      gridDensity: { value: 25.0 },
    }),
    [createUniforms]
  );

  // Orb positions around the head
  const orbData = useMemo(
    () => [
      { pos: [0.8, 0.3, 0.2] as [number, number, number], size: 0.04, speed: 0.8, offset: 0 },
      { pos: [-0.7, 0.5, 0.3] as [number, number, number], size: 0.03, speed: 1.0, offset: 1 },
      { pos: [0.5, -0.2, 0.5] as [number, number, number], size: 0.035, speed: 0.9, offset: 2 },
      { pos: [-0.6, 0.1, -0.3] as [number, number, number], size: 0.025, speed: 1.1, offset: 3 },
      { pos: [0.3, 0.6, -0.4] as [number, number, number], size: 0.03, speed: 0.7, offset: 4 },
      { pos: [-0.4, -0.3, 0.4] as [number, number, number], size: 0.02, speed: 1.2, offset: 5 },
      { pos: [0.6, 0.4, -0.2] as [number, number, number], size: 0.025, speed: 0.85, offset: 6 },
      { pos: [-0.5, 0.7, 0.1] as [number, number, number], size: 0.035, speed: 0.95, offset: 7 },
    ],
    []
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const targetIntensity = isSpeaking ? Math.min(speakingIntensity, 1) : 0;

    // Update all materials
    [headMaterialRef, neckMaterialRef, shoulderMaterialRef].forEach((ref) => {
      if (ref.current) {
        ref.current.uniforms.time.value = time;
        ref.current.uniforms.speakingIntensity.value = THREE.MathUtils.lerp(
          ref.current.uniforms.speakingIntensity.value,
          targetIntensity,
          0.1
        );
      }
    });

    // Subtle floating motion for the whole group
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(time * 0.5) * 0.02;
      groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Head - elongated sphere */}
      <mesh position={[0, 0.1, 0]} scale={[0.85, 1, 0.9]}>
        <sphereGeometry args={[0.35, 64, 64]} />
        <shaderMaterial
          ref={headMaterialRef}
          vertexShader={humanoidVertexShader}
          fragmentShader={humanoidFragmentShader}
          uniforms={headUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner core glow */}
      <mesh position={[0, 0.1, 0]} scale={[0.7, 0.85, 0.75]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Neck */}
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.2, 32]} />
        <shaderMaterial
          ref={neckMaterialRef}
          vertexShader={humanoidVertexShader}
          fragmentShader={humanoidFragmentShader}
          uniforms={neckUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Shoulders - curved shape */}
      <mesh position={[0, -0.45, 0]} rotation={[0.2, 0, 0]}>
        <torusGeometry args={[0.4, 0.08, 16, 32, Math.PI]} />
        <shaderMaterial
          ref={shoulderMaterialRef}
          vertexShader={humanoidVertexShader}
          fragmentShader={humanoidFragmentShader}
          uniforms={shoulderUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Chest/torso hint */}
      <mesh position={[0, -0.55, 0.05]} scale={[1.2, 0.8, 0.6]}>
        <sphereGeometry args={[0.25, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <shaderMaterial
          vertexShader={humanoidVertexShader}
          fragmentShader={humanoidFragmentShader}
          uniforms={shoulderUniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Eyes - subtle glow points */}
      <mesh position={[-0.1, 0.15, 0.28]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0.1, 0.15, 0.28]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Floating orbs */}
      {orbData.map((orb, i) => (
        <FloatingOrb
          key={i}
          position={orb.pos}
          color={color}
          size={orb.size}
          speed={orb.speed}
          offset={orb.offset}
        />
      ))}

      {/* Ambient particle glow around figure */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.8, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.02}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
