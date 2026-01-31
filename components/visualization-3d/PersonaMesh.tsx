"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { humanoidVertexShader, humanoidFragmentShader, hexToRgb, darkenColor } from "./PersonaShaders";

export interface PersonaMeshProps {
  agentId: string;
  color: string;
  position: [number, number, number];
  isSpeaking?: boolean;
  onClick?: () => void;
}

/**
 * Creates humanoid wireframe geometry
 */
function createHumanoidGeometry(): THREE.BufferGeometry {
  // Head (High detail sphere, slightly elongated)
  const headGeo = new THREE.SphereGeometry(1.5, 20, 14);
  headGeo.scale(0.85, 1.1, 0.95);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.6, 0.8, 1.5, 16);
  neckGeo.translate(0, -2.0, 0);

  // Shoulders
  const shoulderGeo = new THREE.CylinderGeometry(0.5, 3.5, 2, 20, 4, true);
  shoulderGeo.translate(0, -3.5, 0);
  shoulderGeo.scale(1.5, 1, 0.8);

  const mergedGeo = mergeGeometries([headGeo, neckGeo, shoulderGeo]);

  headGeo.dispose();
  neckGeo.dispose();
  shoulderGeo.dispose();

  if (!mergedGeo) {
    console.error("Failed to merge geometries");
    return new THREE.BufferGeometry();
  }

  return new THREE.WireframeGeometry(mergedGeo);
}

// Cache geometry
let cachedGeometry: THREE.BufferGeometry | null = null;

function getSharedGeometry(): THREE.BufferGeometry {
  if (!cachedGeometry) {
    cachedGeometry = createHumanoidGeometry();
  }
  return cachedGeometry;
}

export function PersonaMesh({
  agentId,
  color,
  position,
  isSpeaking = false,
  onClick,
}: PersonaMeshProps) {
  const meshRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const basePositionY = useRef(position[1]);

  const geometry = useMemo(() => getSharedGeometry(), []);

  const primaryColor = useMemo(() => new THREE.Color(color), [color]);
  const secondaryColor = useMemo(() => new THREE.Color(darkenColor(color)), [color]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorPrimary: { value: primaryColor },
        colorSecondary: { value: secondaryColor },
        speakingIntensity: { value: 0 },
      },
      vertexShader: humanoidVertexShader,
      fragmentShader: humanoidFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
  }, [primaryColor, secondaryColor]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;

      // Smoothly interpolate speaking intensity
      const targetIntensity = isSpeaking ? 1.0 : 0.0;
      const currentIntensity = materialRef.current.uniforms.speakingIntensity.value;
      materialRef.current.uniforms.speakingIntensity.value +=
        (targetIntensity - currentIntensity) * delta * 5;
    }

    if (meshRef.current) {
      // Scale animation for speaking
      const targetScale = isSpeaking ? 1.15 : 1.0;
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 3
      );

      // Gentle floating effect
      const offset = agentId.charCodeAt(0) % 3;
      meshRef.current.position.y =
        basePositionY.current + Math.sin(state.clock.elapsedTime + offset) * 0.2;

      // Slow rotation
      meshRef.current.rotation.y += delta * (isSpeaking ? 0.8 : 0.3);
    }
  });

  useEffect(() => {
    if (meshRef.current) {
      materialRef.current = meshRef.current.material as THREE.ShaderMaterial;
    }
  }, []);

  return (
    <group position={position} onClick={onClick}>
      <lineSegments ref={meshRef} geometry={geometry} material={material} />
    </group>
  );
}
