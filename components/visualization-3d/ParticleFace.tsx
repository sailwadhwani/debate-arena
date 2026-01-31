"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import * as THREE from "three";
import { particleVertexShader, particleFragmentShader } from "./ParticleShaders";

interface ParticleFaceProps {
  position?: [number, number, number];
  color: string;
  isVisible: boolean;
  isSpeaking: boolean;
  modelPath?: string;
  particleCount?: number;
  scale?: number;
}

// Sample points from a mesh surface
function sampleMeshSurface(mesh: THREE.Mesh, count: number): Float32Array {
  try {
    const sampler = new MeshSurfaceSampler(mesh).build();
    const positions = new Float32Array(count * 3);
    const tempPosition = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      sampler.sample(tempPosition);
      positions[i * 3] = tempPosition.x;
      positions[i * 3 + 1] = tempPosition.y;
      positions[i * 3 + 2] = tempPosition.z;
    }
    return positions;
  } catch {
    // Fallback: use vertex positions
    const vertexPositions = mesh.geometry.attributes.position;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const idx = i % vertexPositions.count;
      positions[i * 3] = vertexPositions.getX(idx);
      positions[i * 3 + 1] = vertexPositions.getY(idx);
      positions[i * 3 + 2] = vertexPositions.getZ(idx);
    }
    return positions;
  }
}

// Normalize mesh to consistent size
function normalizeMesh(mesh: THREE.Mesh, targetSize: number = 1.5) {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const scale = targetSize / maxDim;
    mesh.geometry.scale(scale, scale, scale);
  }
  mesh.geometry.center();
}

// Create cloud positions
function createCloudPositions(count: number, radius: number = 1.5): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.5 + Math.random() * 0.5);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return positions;
}

export function ParticleFace({
  position = [0, 0, 0],
  color,
  isVisible,
  isSpeaking,
  modelPath = "/models/face2.obj",
  particleCount = 15000,
  scale = 1,
}: ParticleFaceProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [facePositions, setFacePositions] = useState<Float32Array | null>(null);
  const targetFormProgress = useRef(0);

  // Load OBJ model
  const obj = useLoader(OBJLoader, modelPath);

  // Process mesh when loaded
  useEffect(() => {
    if (!obj) return;

    let mesh: THREE.Mesh | null = null;
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !mesh) {
        mesh = (child as THREE.Mesh).clone();
      }
    });

    if (mesh) {
      normalizeMesh(mesh, 1.5);
      const positions = sampleMeshSurface(mesh, particleCount);
      setFacePositions(positions);
    }
  }, [obj, particleCount]);

  // Create geometry with cloud and face positions
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    // Initial cloud positions
    const cloudPositions = createCloudPositions(particleCount, 2);
    geo.setAttribute("position", new THREE.BufferAttribute(cloudPositions.slice(), 3));
    geo.setAttribute("aCloudPosition", new THREE.BufferAttribute(cloudPositions, 3));

    // Random values for variation
    const randoms = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      randoms[i] = Math.random();
    }
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    return geo;
  }, [particleCount]);

  // Update face positions when loaded
  useEffect(() => {
    if (facePositions && geometry) {
      geometry.setAttribute("position", new THREE.BufferAttribute(facePositions, 3));
    }
  }, [facePositions, geometry]);

  // Shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMouse: { value: new THREE.Vector3(100, 100, 100) },
        uRadius: { value: 0.5 },
        uStrength: { value: 0.3 },
        uColor: { value: new THREE.Color(color) },
        uSize: { value: 2.5 },
        uOpacity: { value: 0.9 },
        uTime: { value: 0 },
        uFormProgress: { value: 0 },
        uCloudCenter: { value: new THREE.Vector3(0, 0, 0) },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color]);

  // Animation frame
  useFrame((state) => {
    if (!materialRef.current) return;

    const time = state.clock.elapsedTime;
    materialRef.current.uniforms.uTime.value = time * 1000;

    // Animate formation progress
    targetFormProgress.current = isVisible ? 1 : 0;
    const currentProgress = materialRef.current.uniforms.uFormProgress.value;
    const newProgress = THREE.MathUtils.lerp(currentProgress, targetFormProgress.current, 0.03);
    materialRef.current.uniforms.uFormProgress.value = newProgress;

    // Pulsing when speaking
    if (isSpeaking) {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      materialRef.current.uniforms.uSize.value = 2.5 * pulse;
      materialRef.current.uniforms.uOpacity.value = 0.85 + Math.sin(time * 3) * 0.1;
    } else {
      materialRef.current.uniforms.uSize.value = 2.5;
      materialRef.current.uniforms.uOpacity.value = isVisible ? 0.9 : 0.4;
    }

    // Gentle rotation when speaking
    if (pointsRef.current) {
      if (isSpeaking) {
        pointsRef.current.rotation.y = Math.sin(time * 0.5) * 0.15;
      } else {
        pointsRef.current.rotation.y *= 0.95; // Ease back to center
      }
    }
  });

  return (
    <group position={position} scale={scale}>
      <points ref={pointsRef} geometry={geometry}>
        <primitive object={material} ref={materialRef} attach="material" />
      </points>
    </group>
  );
}
