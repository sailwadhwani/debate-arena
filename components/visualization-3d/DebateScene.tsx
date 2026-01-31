"use client";

import { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import * as THREE from "three";
import { gsap } from "gsap";
import type { DebateArgument } from "@/lib/agents/types";

interface Agent {
  id: string;
  name: string;
  color: string;
}

type DebateStatus = "idle" | "loading" | "debating" | "concluding" | "complete" | "error";

interface DebateSceneProps {
  agents: Agent[];
  speakingAgentId?: string;
  currentArgument?: DebateArgument;
  arguments?: DebateArgument[];
  status?: DebateStatus;
  thinkingAgentId?: string;
}

const PARTICLE_COUNT = 15000;
const SMALL_PARTICLE_COUNT = 8000;
const FACE_MODEL = "/models/face2.obj"; // Use best model for all

// Shaders
const vertexShader = `
  uniform vec3 uMouse;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uSize;
  uniform float uTime;

  attribute float aRandom;

  void main() {
    vec3 pos = position;
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

    float dist = distance(worldPosition.xyz, uMouse);
    float slowTime = uTime * 0.0002;
    float noise = aRandom;

    float falloff = smoothstep(uRadius * (1.2 + noise * 0.5), 0.0, dist);

    if (falloff > 0.0) {
      vec3 randomDir = vec3(
        sin(pos.x * 0.15 + slowTime + noise * 6.28),
        cos(pos.y * 0.15 + slowTime * 1.1 + noise * 6.28),
        sin(pos.z * 0.15 + slowTime * 1.2 + noise * 6.28)
      );

      vec3 repelDir = normalize(worldPosition.xyz - uMouse);
      vec3 finalDir = normalize(repelDir * 0.3 + randomDir * 0.7);

      float displacement = falloff * uStrength * (0.8 + sin(uTime * 0.001 + noise * 6.28) * 0.2);
      worldPosition.xyz += finalDir * displacement;
    }

    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`;

// Speech particles shader
const speechParticleVertex = `
  uniform float uTime;
  uniform float uSize;
  attribute float aRandom;
  attribute float aLife;
  varying float vLife;
  varying float vRandom;

  void main() {
    vLife = aLife;
    vRandom = aRandom;

    vec3 pos = position;
    float progress = mod(uTime * 0.5 + aRandom, 1.0);
    pos.x += sin(aRandom * 6.28 + uTime) * progress * 3.0;
    pos.y += progress * 5.0 + sin(uTime * 2.0 + aRandom * 3.14) * 0.5;
    pos.z += cos(aRandom * 6.28 + uTime) * progress * 2.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float size = uSize * (1.0 - progress * 0.7);
    gl_PointSize = size * (200.0 / -mvPosition.z);
  }
`;

const speechParticleFragment = `
  uniform vec3 uColor;
  varying float vLife;
  varying float vRandom;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float progress = mod(vLife + vRandom, 1.0);
    float alpha = (1.0 - progress) * 0.6;
    alpha *= 1.0 - smoothstep(0.2, 0.5, dist);

    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Helper functions
function normalizeMesh(mesh: THREE.Mesh, targetSize: number = 20) {
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

function samplePointsOnSurface(mesh: THREE.Mesh, count: number): Float32Array {
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

function createCloudPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 8 + Math.random() * 8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  return positions;
}

// Load face model once
let cachedFacePositions: Float32Array | null = null;
let cachedSmallFacePositions: Float32Array | null = null;

async function loadFaceModel(): Promise<{ large: Float32Array; small: Float32Array } | null> {
  if (cachedFacePositions && cachedSmallFacePositions) {
    return { large: cachedFacePositions, small: cachedSmallFacePositions };
  }

  return new Promise((resolve) => {
    const loader = new OBJLoader();
    loader.load(
      FACE_MODEL,
      (obj) => {
        let mesh: THREE.Mesh | null = null;
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const childMesh = child as THREE.Mesh;
            if (!mesh || (childMesh.geometry.attributes.position?.count > (mesh.geometry.attributes.position?.count || 0))) {
              mesh = childMesh.clone();
            }
          }
        });

        if (mesh) {
          // Large version
          const foundMesh = mesh as THREE.Mesh;
          const largeMesh = foundMesh.clone();
          normalizeMesh(largeMesh, 20);
          cachedFacePositions = samplePointsOnSurface(largeMesh, PARTICLE_COUNT);

          // Small version - larger for visibility
          const smallMesh = foundMesh.clone();
          normalizeMesh(smallMesh, 9);
          cachedSmallFacePositions = samplePointsOnSurface(smallMesh, SMALL_PARTICLE_COUNT);

          resolve({ large: cachedFacePositions, small: cachedSmallFacePositions });
        } else {
          resolve(null);
        }
      },
      undefined,
      () => resolve(null)
    );
  });
}

// Speech particles component
function SpeechParticles({ color, isActive }: { color: string; isActive: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const particleCount = 50;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount);
    const lifes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = -3 + Math.random() * 2;
      positions[i * 3 + 2] = 8 + Math.random() * 2;
      randoms[i] = Math.random();
      lifes[i] = Math.random();
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));
    geo.setAttribute("aLife", new THREE.BufferAttribute(lifes, 1));

    return geo;
  }, []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 4.0 },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: speechParticleVertex,
      fragmentShader: speechParticleFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [color]);

  useFrame(({ clock }) => {
    if (materialRef.current && isActive) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  if (!isActive) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <primitive object={material} ref={materialRef} attach="material" />
    </points>
  );
}

// Teleprompter text component - sleek holographic style
function TeleprompterText({ text, agentName, color }: { text: string; agentName: string; color: string }) {
  const [displayText, setDisplayText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const words = useMemo(() => text.split(" "), [text]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayText("");
    setWordIndex(0);

    const interval = setInterval(() => {
      setWordIndex((prev) => {
        if (prev < words.length) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [text, words.length]);

  useEffect(() => {
    setDisplayText(words.slice(0, wordIndex).join(" "));
  }, [wordIndex, words]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayText]);

  const progress = (wordIndex / words.length) * 100;

  return (
    <Html center position={[0, 16, 0]} distanceFactor={50} style={{ width: "550px", pointerEvents: "none" }}>
      <div className="relative">
        {/* Outer glow effect */}
        <div
          className="absolute -inset-1 rounded-3xl opacity-50 blur-xl"
          style={{ background: `radial-gradient(ellipse at center, ${color}40 0%, transparent 70%)` }}
        />

        {/* Main container */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.85) 100%)`,
            border: `1px solid ${color}40`,
            boxShadow: `
              0 0 40px ${color}20,
              inset 0 1px 0 rgba(255,255,255,0.1),
              inset 0 -1px 0 rgba(0,0,0,0.3)
            `,
          }}
        >
          {/* Header with scan line effect */}
          <div
            className="relative px-6 py-3"
            style={{
              background: `linear-gradient(90deg, ${color}15 0%, transparent 50%, ${color}15 100%)`,
              borderBottom: `1px solid ${color}30`,
            }}
          >
            {/* Decorative corner accents */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 rounded-tl-lg" style={{ borderColor: color }} />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 rounded-tr-lg" style={{ borderColor: color }} />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Animated speaking indicator */}
                <div className="relative">
                  <span
                    className="block w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}` }}
                  />
                  <span
                    className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-75"
                    style={{ backgroundColor: color }}
                  />
                </div>
                <span
                  className="text-lg font-bold tracking-wide"
                  style={{ color: "white", textShadow: `0 0 20px ${color}` }}
                >
                  {agentName}
                </span>
              </div>

              {/* Audio wave visualization */}
              <div className="flex items-center gap-0.5 h-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full animate-pulse"
                    style={{
                      backgroundColor: color,
                      height: `${40 + Math.sin(i * 1.5) * 30}%`,
                      animationDelay: `${i * 100}ms`,
                      animationDuration: "0.5s",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div
            ref={containerRef}
            className="px-6 py-5 max-h-[200px] overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <p className="text-lg text-gray-100 leading-relaxed font-light tracking-wide">
              {displayText}
              <span
                className="inline-block w-0.5 h-5 ml-1 animate-pulse"
                style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
              />
            </p>
          </div>

          {/* Progress bar at bottom */}
          <div className="relative h-1" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="absolute inset-y-0 left-0 transition-all duration-200 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${color}80, ${color})`,
                boxShadow: `0 0 15px ${color}80`,
              }}
            />
            {/* Progress indicator dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-200"
              style={{
                left: `${progress}%`,
                transform: `translateX(-50%) translateY(-50%)`,
                backgroundColor: "white",
                boxShadow: `0 0 10px ${color}`,
              }}
            />
          </div>

          {/* Bottom decorative corners */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 rounded-bl-lg"
            style={{ borderColor: `${color}50` }}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 rounded-br-lg"
            style={{ borderColor: `${color}50` }}
          />
        </div>
      </div>
    </Html>
  );
}

// Glow ring around waiting agents - enhanced with multiple rings
function GlowRing({ color, scale = 1 }: { color: string; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = clock.elapsedTime * 0.3;
    }
  });

  return (
    <group ref={groupRef} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
      {/* Main ring */}
      <mesh>
        <torusGeometry args={[4.5, 0.1, 16, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      {/* Inner glow ring */}
      <mesh scale={0.85}>
        <torusGeometry args={[4.5, 0.05, 16, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      {/* Outer subtle ring */}
      <mesh scale={1.15}>
        <torusGeometry args={[4.5, 0.03, 16, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

// Small waiting agent face
function WaitingAgentFace({
  agent,
  facePositions,
  position,
  index,
  total,
}: {
  agent: Agent;
  facePositions: Float32Array;
  position: [number, number, number];
  index: number;
  total: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(facePositions.slice(), 3));

    const randoms = new Float32Array(SMALL_PARTICLE_COUNT);
    for (let i = 0; i < SMALL_PARTICLE_COUNT; i++) {
      randoms[i] = Math.random();
    }
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    return geo;
  }, [facePositions]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMouse: { value: new THREE.Vector3(100, 100, 100) },
        uRadius: { value: 3 },
        uStrength: { value: 1.5 },
        uColor: { value: new THREE.Color(agent.color) },
        uSize: { value: 2.2 },
        uOpacity: { value: 0.85 },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [agent.color]);

  useFrame(() => {
    if (!pointsRef.current || !materialRef.current) return;
    timeRef.current += 0.016;

    // Gentle idle animation - bobbing and rotation
    pointsRef.current.rotation.y = Math.sin(timeRef.current * 0.5 + index) * 0.15;

    // Subtle breathing/pulsing effect
    const pulse = 1 + Math.sin(timeRef.current * 2 + index * 0.5) * 0.05;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(pulse);
    }

    materialRef.current.uniforms.uTime.value = performance.now();
    materialRef.current.uniforms.uOpacity.value = 0.75 + Math.sin(timeRef.current * 1.5 + index) * 0.15;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Glow ring base - larger ring for visibility */}
      <GlowRing color={agent.color} scale={1.5} />

      {/* Particle face */}
      <points ref={pointsRef} geometry={geometry}>
        <primitive object={material} ref={materialRef} attach="material" />
      </points>

      {/* Name on neck - simple text */}
      <Html center position={[0, -2.5, 4]} distanceFactor={40} style={{ pointerEvents: "none" }}>
        <span
          className="text-sm font-bold tracking-widest uppercase whitespace-nowrap"
          style={{
            color: "white",
            textShadow: `0 0 8px ${agent.color}, 0 0 16px ${agent.color}, 0 2px 4px rgba(0,0,0,0.9)`,
          }}
        >
          {agent.name}
        </span>
      </Html>
    </group>
  );
}

// Main speaking agent face
function MainSpeakingFace({
  agent,
  facePositions,
  cloudPositions,
  isSpeaking,
  currentArgument,
}: {
  agent: Agent | null;
  facePositions: Float32Array | null;
  cloudPositions: Float32Array;
  isSpeaking: boolean;
  currentArgument?: DebateArgument;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [currentTarget, setCurrentTarget] = useState<string | null>(null);
  const isTransitioning = useRef(false);
  const timeRef = useRef(0);
  const mouse = useRef(new THREE.Vector2(-100, -100));
  const mouseWorld = useRef(new THREE.Vector3());
  const { camera } = useThree();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(cloudPositions.slice(), 3));

    const randoms = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      randoms[i] = Math.random();
    }
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    return geo;
  }, [cloudPositions]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMouse: { value: new THREE.Vector3(100, 100, 100) },
        uRadius: { value: 8 },
        uStrength: { value: 4 },
        uColor: { value: new THREE.Color("#00aaff") },
        uSize: { value: 2.0 },
        uOpacity: { value: 0.85 },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  const morphTo = useCallback((targetPositions: Float32Array, color: string, duration: number = 2.0) => {
    if (!pointsRef.current || isTransitioning.current) return;

    isTransitioning.current = true;
    const currentPositions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const mat = pointsRef.current.material as THREE.ShaderMaterial;

    const targetColor = new THREE.Color(color);
    gsap.to(mat.uniforms.uColor.value, {
      duration,
      r: targetColor.r,
      g: targetColor.g,
      b: targetColor.b,
      ease: "power2.inOut",
    });

    gsap.to(currentPositions, {
      duration,
      endArray: targetPositions as unknown as number[],
      ease: "power3.inOut",
      onUpdate: () => {
        if (pointsRef.current) {
          pointsRef.current.geometry.attributes.position.needsUpdate = true;
        }
      },
      onComplete: () => {
        isTransitioning.current = false;
      },
    });
  }, []);

  // Handle speaking changes
  useEffect(() => {
    if (isSpeaking && agent && facePositions && agent.id !== currentTarget) {
      morphTo(facePositions, agent.color, 2.0);
      setCurrentTarget(agent.id);
    } else if (!isSpeaking && currentTarget) {
      morphTo(cloudPositions, "#0066aa", 1.5);
      setCurrentTarget(null);
    }
  }, [isSpeaking, agent, facePositions, currentTarget, morphTo, cloudPositions]);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleMouseLeave = () => {
      mouse.current.set(-100, -100);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  useFrame(() => {
    if (!pointsRef.current || !materialRef.current) return;

    timeRef.current += 0.016;
    const mat = materialRef.current;

    // Gentle rotation
    pointsRef.current.rotation.y = Math.sin(timeRef.current * 0.3) * 0.3;
    pointsRef.current.rotation.x = Math.sin(timeRef.current * 0.2) * 0.1;

    // Floating when in cloud state
    if (!currentTarget && !isTransitioning.current) {
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const noise = Math.sin(timeRef.current + i * 0.01) * 0.03;
        positions[i3] += Math.sin(timeRef.current * 0.5 + i) * 0.012 + noise;
        positions[i3 + 1] += Math.cos(timeRef.current * 0.4 + i * 0.5) * 0.012;
        positions[i3 + 2] += Math.sin(timeRef.current * 0.3 + i * 0.3) * 0.008;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Mouse interaction
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse.current, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    raycaster.ray.intersectPlane(plane, mouseWorld.current);

    mat.uniforms.uMouse.value.copy(mouseWorld.current);
    mat.uniforms.uTime.value = performance.now();
  });

  return (
    <>
      <points ref={pointsRef} geometry={geometry}>
        <primitive object={material} ref={materialRef} attach="material" />
      </points>

      {/* Name on neck - simple text */}
      {agent && isSpeaking && (
        <Html center position={[0, -6, 8]} distanceFactor={40} style={{ pointerEvents: "none" }}>
          <span
            className="text-lg font-bold tracking-widest uppercase whitespace-nowrap"
            style={{
              color: "white",
              textShadow: `0 0 12px ${agent.color}, 0 0 24px ${agent.color}, 0 2px 8px rgba(0,0,0,0.9)`,
            }}
          >
            {agent.name}
          </span>
        </Html>
      )}

      {/* Speech particles */}
      {agent && isSpeaking && (
        <SpeechParticles color={agent.color} isActive={true} />
      )}

      {/* Teleprompter */}
      {agent && isSpeaking && currentArgument && (
        <TeleprompterText text={currentArgument.content} agentName={agent.name} color={agent.color} />
      )}
    </>
  );
}

// Ambient floating particles for atmosphere
function AmbientParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 200;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      sizes[i] = Math.random() * 2 + 0.5;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = clock.elapsedTime * 0.1;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3 + 1] += Math.sin(time + i * 0.1) * 0.02;
      positions[i3] += Math.cos(time + i * 0.05) * 0.01;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={1.5}
        color="#4488ff"
        transparent
        opacity={0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Subtle grid floor effect
function GridFloor() {
  return (
    <group position={[0, -20, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <planeGeometry args={[200, 200, 40, 40]} />
        <meshBasicMaterial
          color="#0a1525"
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>
      {/* Gradient fade overlay */}
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial
          transparent
          opacity={0.8}
          color="#030014"
        />
      </mesh>
    </group>
  );
}

// Main scene
function Scene(props: DebateSceneProps) {
  const [faceData, setFaceData] = useState<{ large: Float32Array; small: Float32Array } | null>(null);
  const [cloudPositions] = useState(() => createCloudPositions(PARTICLE_COUNT));

  // Load face model
  useEffect(() => {
    loadFaceModel().then(setFaceData);
  }, []);

  const speakingAgent = props.agents.find(a => a.id === props.speakingAgentId);
  const waitingAgents = props.agents.filter(a => a.id !== props.speakingAgentId);

  // Calculate waiting agent positions at bottom - visible in camera view
  const getWaitingPosition = (index: number, total: number): [number, number, number] => {
    if (total === 0) return [0, 0, 0];
    const spacing = Math.min(16, 50 / total);
    const startX = -((total - 1) * spacing) / 2;
    return [startX + index * spacing, -12, 15];
  };

  return (
    <>
      <ambientLight intensity={0.1} />

      {/* Atmospheric elements */}
      <AmbientParticles />

      {/* Main speaking face (center stage) */}
      <MainSpeakingFace
        agent={speakingAgent || null}
        facePositions={faceData?.large || null}
        cloudPositions={cloudPositions}
        isSpeaking={!!speakingAgent}
        currentArgument={props.currentArgument}
      />

      {/* Waiting agents at bottom */}
      {faceData && waitingAgents.map((agent, index) => (
        <WaitingAgentFace
          key={agent.id}
          agent={agent}
          facePositions={faceData.small}
          position={getWaitingPosition(index, waitingAgents.length)}
          index={index}
          total={waitingAgents.length}
        />
      ))}
    </>
  );
}

export function DebateScene(props: DebateSceneProps) {
  // Debug: log props changes
  useEffect(() => {
    console.log("[DebateScene] Props updated:", {
      status: props.status,
      speakingAgentId: props.speakingAgentId,
      thinkingAgentId: props.thinkingAgentId,
      hasCurrentArgument: !!props.currentArgument,
      argumentsCount: props.arguments?.length || 0,
      agentsCount: props.agents?.length || 0,
    });
  }, [props.status, props.speakingAgentId, props.thinkingAgentId, props.currentArgument, props.arguments, props.agents]);

  return (
    <div className="absolute inset-0 bg-[#030014]">
      <Canvas
        camera={{ position: [0, 0, 45], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#030014"]} />
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>

      {/* Debug panel - bottom left */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-4 left-4 z-50 p-3 rounded-lg bg-black/80 text-xs font-mono text-white/70 max-w-xs">
          <div>Status: <span className="text-cyan-400">{props.status || "idle"}</span></div>
          <div>Speaking: <span className="text-green-400">{props.speakingAgentId || "none"}</span></div>
          <div>Thinking: <span className="text-yellow-400">{props.thinkingAgentId || "none"}</span></div>
          <div>Has Argument: <span className="text-purple-400">{props.currentArgument ? "yes" : "no"}</span></div>
          <div>Total Args: <span className="text-blue-400">{props.arguments?.length || 0}</span></div>
        </div>
      )}

      {/* Status Indicator */}
      {props.status && props.status !== "idle" && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          {/* Loading/Connecting */}
          {props.status === "loading" && (
            <div
              className="flex items-center gap-4 px-6 py-3 rounded-full backdrop-blur-xl"
              style={{
                background: "linear-gradient(135deg, rgba(0,200,255,0.1) 0%, rgba(0,100,200,0.05) 100%)",
                border: "1px solid rgba(0,200,255,0.2)",
                boxShadow: "0 0 40px rgba(0,200,255,0.15)",
              }}
            >
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce shadow-lg shadow-cyan-400/50" style={{ animationDelay: "0ms" }} />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce shadow-lg shadow-cyan-400/50" style={{ animationDelay: "150ms" }} />
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-bounce shadow-lg shadow-cyan-400/50" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-cyan-300 text-sm font-medium tracking-widest uppercase">Connecting...</span>
            </div>
          )}

          {/* Agent Thinking */}
          {props.status === "debating" && props.thinkingAgentId && !props.currentArgument && (
            <div
              className="flex items-center gap-4 px-6 py-3 rounded-full backdrop-blur-xl"
              style={{
                background: "linear-gradient(135deg, rgba(255,200,0,0.1) 0%, rgba(255,150,0,0.05) 100%)",
                border: "1px solid rgba(255,200,0,0.3)",
                boxShadow: "0 0 40px rgba(255,200,0,0.15)",
              }}
            >
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50" style={{ animationDelay: "200ms" }} />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50" style={{ animationDelay: "400ms" }} />
              </div>
              <span className="text-yellow-300 text-sm font-medium tracking-widest uppercase">
                {props.agents.find(a => a.id === props.thinkingAgentId)?.name || "Agent"} is thinking...
              </span>
            </div>
          )}

          {/* Agent Speaking (has argument) */}
          {props.status === "debating" && props.speakingAgentId && props.currentArgument && (() => {
            const agent = props.agents.find(a => a.id === props.speakingAgentId);
            return (
              <div
                className="flex items-center gap-4 px-6 py-3 rounded-full backdrop-blur-xl"
                style={{
                  background: `linear-gradient(135deg, ${agent?.color || "#00ff00"}15 0%, ${agent?.color || "#00ff00"}08 100%)`,
                  border: `1px solid ${agent?.color || "#00ff00"}40`,
                  boxShadow: `0 0 40px ${agent?.color || "#00ff00"}20`,
                }}
              >
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: agent?.color, boxShadow: `0 0 8px ${agent?.color}` }} />
                  <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: agent?.color, boxShadow: `0 0 8px ${agent?.color}`, animationDelay: "100ms" }} />
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: agent?.color, boxShadow: `0 0 8px ${agent?.color}`, animationDelay: "200ms" }} />
                </div>
                <span className="text-sm font-medium tracking-widest uppercase" style={{ color: agent?.color, textShadow: `0 0 10px ${agent?.color}50` }}>
                  {agent?.name || "Agent"} is speaking
                </span>
              </div>
            );
          })()}

          {/* Concluding */}
          {props.status === "concluding" && (
            <div
              className="flex items-center gap-4 px-6 py-3 rounded-full backdrop-blur-xl"
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(139,92,246,0.05) 100%)",
                border: "1px solid rgba(168,85,247,0.3)",
                boxShadow: "0 0 40px rgba(168,85,247,0.15)",
              }}
            >
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50" />
              </div>
              <span className="text-purple-300 text-sm font-medium tracking-widest uppercase">Generating Summary...</span>
            </div>
          )}

          {/* Complete */}
          {props.status === "complete" && (
            <div
              className="flex items-center gap-4 px-6 py-3 rounded-full backdrop-blur-xl"
              style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(22,163,74,0.05) 100%)",
                border: "1px solid rgba(34,197,94,0.3)",
                boxShadow: "0 0 40px rgba(34,197,94,0.15)",
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
              <span className="text-green-300 text-sm font-medium tracking-widest uppercase">Debate Complete</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
