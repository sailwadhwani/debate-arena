"use client";

import { Suspense, useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import * as THREE from "three";
import { gsap } from "gsap";
import type { DebateArgument, DebateSummary } from "@/lib/agents/types";

// ============================================================================
// AGENT VISUAL SIGNATURES - Icons/symbols for each agent type
// ============================================================================
const AGENT_SIGNATURES: Record<string, { symbols: string[]; orbits: number }> = {
  "dr-house": { symbols: ["💊", "🩺", "❤️", "🧬"], orbits: 4 },
  "politician": { symbols: ["📜", "🏛️", "⚖️", "🗳️"], orbits: 3 },
  "scientist": { symbols: ["🔬", "⚗️", "🧪", "📊"], orbits: 4 },
  "business-strategist": { symbols: ["📈", "💼", "🎯", "💰"], orbits: 3 },
  "compliance-counsel": { symbols: ["⚖️", "📋", "🔒", "📑"], orbits: 3 },
  "default": { symbols: ["💭", "✨", "🎯", "💡"], orbits: 3 },
};

interface Agent {
  id: string;
  name: string;
  color: string;
}

type DebateStatus = "idle" | "loading" | "debating" | "paused" | "concluding" | "complete" | "error";

interface CurrentTool {
  name: string;
  input?: Record<string, unknown>;
}

interface DebateSceneProps {
  agents: Agent[];
  speakingAgentId?: string;
  currentArgument?: DebateArgument;
  arguments?: DebateArgument[];
  status?: DebateStatus;
  thinkingAgentId?: string;
  currentTool?: CurrentTool;
  summary?: DebateSummary;
  task?: string;
  onReset?: () => void;
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

// ============================================================================
// ARENA FLOOR SHADER - Reactive circular grid
// ============================================================================
const arenaFloorVertex = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Subtle wave effect based on intensity
    float dist = length(uv - 0.5) * 2.0;
    float wave = sin(dist * 10.0 - uTime * 2.0) * 0.5 * uIntensity;
    pos.z += wave * (1.0 - dist);
    vElevation = wave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const arenaFloorFragment = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vElevation;

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0;

    // Circular boundary fade
    float circleFade = 1.0 - smoothstep(0.8, 1.0, dist);

    // Grid pattern
    vec2 grid = abs(fract(centered * 20.0) - 0.5);
    float gridLine = min(grid.x, grid.y);
    float gridPattern = 1.0 - smoothstep(0.0, 0.05, gridLine);

    // Radial lines
    float angle = atan(centered.y, centered.x);
    float radialLines = abs(sin(angle * 12.0));
    float radialPattern = smoothstep(0.98, 1.0, radialLines) * 0.5;

    // Concentric circles
    float circles = abs(sin(dist * 15.0 - uTime));
    float circlePattern = smoothstep(0.95, 1.0, circles) * 0.3;

    // Pulse from center based on intensity
    float pulse = sin(dist * 8.0 - uTime * 3.0) * 0.5 + 0.5;
    pulse *= uIntensity * (1.0 - dist);

    // Combine patterns
    float pattern = gridPattern * 0.4 + radialPattern + circlePattern + pulse * 0.3;
    pattern *= circleFade;

    // Color with intensity
    vec3 color = uColor * (0.3 + pattern * 0.7);
    color += vec3(0.1, 0.2, 0.3) * vElevation * 2.0;

    float alpha = pattern * 0.6 * circleFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// ENERGY ARC SHADER - Lightning between agents
// ============================================================================
const energyArcVertex = `
  uniform float uTime;
  attribute float aProgress;
  varying float vProgress;

  void main() {
    vProgress = aProgress;
    vec3 pos = position;

    // Add noise displacement
    float noise = sin(aProgress * 20.0 + uTime * 5.0) * 0.5;
    pos.y += noise;
    pos.x += cos(aProgress * 15.0 + uTime * 3.0) * 0.3;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const energyArcFragment = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying float vProgress;

  void main() {
    // Pulsing glow
    float glow = sin(vProgress * 30.0 - uTime * 10.0) * 0.5 + 0.5;
    float alpha = glow * uIntensity * 0.8;

    // Brighten at the center of the arc
    float centerBright = 1.0 - abs(vProgress - 0.5) * 2.0;
    alpha *= 0.5 + centerBright * 0.5;

    gl_FragColor = vec4(uColor * (1.0 + glow * 0.5), alpha);
  }
`;

// Format tool name for display
function formatToolName(toolName: string): string {
  const toolDisplayNames: Record<string, string> = {
    web_search: "Searching the web...",
    query_document: "Analyzing document...",
    calculator: "Running calculations...",
    evaluate_consensus: "Evaluating consensus...",
    identify_conflicts: "Identifying conflicts...",
    assess_progress: "Assessing progress...",
  };

  return toolDisplayNames[toolName] || `Using ${toolName.replace(/_/g, " ")}...`;
}

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

// Holographic HUD Frame around speaking agent
function HolographicHUD({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Subtle rotation pulse
      groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer hexagonal frame */}
      <mesh rotation={[0, 0, Math.PI / 6]}>
        <ringGeometry args={[14, 14.3, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {/* Inner ring */}
      <mesh>
        <ringGeometry args={[12, 12.1, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      {/* Data lines */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]}>
          <planeGeometry args={[0.1, 18]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// Teleprompter text component - positioned to the side for better visibility
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
    }, 80);

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

  // Position to the right side of the face - vertically centered
  return (
    <Html position={[24, 0, 0]} distanceFactor={45} style={{ width: "340px", pointerEvents: "none" }}>
      <div className="relative">
        {/* Holographic glow effect */}
        <div
          className="absolute -inset-4 rounded-lg opacity-20 blur-3xl"
          style={{ background: `radial-gradient(ellipse at left, ${color}80 0%, transparent 60%)` }}
        />

        {/* Connection line to face - animated data stream */}
        <div
          className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 flex items-center"
          style={{ width: "80px" }}
        >
          {/* Bracket connector */}
          <svg width="20" height="40" className="flex-shrink-0" style={{ marginRight: "-1px" }}>
            <path
              d="M20 0 L5 0 Q0 0 0 5 L0 35 Q0 40 5 40 L20 40"
              fill="none"
              stroke={color}
              strokeWidth="1"
              strokeOpacity="0.5"
            />
          </svg>
          {/* Main line with glow */}
          <div className="flex-1 relative">
            <div
              className="h-px w-full"
              style={{
                background: `linear-gradient(90deg, ${color}30, ${color}80)`,
                boxShadow: `0 0 4px ${color}40`,
              }}
            />
            {/* Data packets animation */}
            <div
              className="absolute top-0 h-px w-3 rounded-full"
              style={{
                background: color,
                boxShadow: `0 0 6px ${color}`,
                animation: "slideRight 1.5s linear infinite",
              }}
            />
            <div
              className="absolute top-0 h-px w-2 rounded-full"
              style={{
                background: color,
                boxShadow: `0 0 4px ${color}`,
                animation: "slideRight 1.5s linear infinite 0.5s",
              }}
            />
          </div>
        </div>
        {/* Connection dot */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full animate-pulse"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}, 0 0 24px ${color}50`,
            marginLeft: '-4px'
          }}
        />

        {/* Main container - sleek sci-fi panel */}
        <div
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(10,20,40,0.9) 100%)`,
            border: `1px solid ${color}50`,
            borderLeft: `3px solid ${color}`,
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)',
            boxShadow: `
              0 0 30px ${color}15,
              inset 0 0 30px rgba(0,0,0,0.5)
            `,
          }}
        >
          {/* Scan line overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
            }}
          />

          {/* Header */}
          <div
            className="relative px-4 py-2 flex items-center justify-between"
            style={{
              background: `linear-gradient(90deg, ${color}20 0%, transparent 100%)`,
              borderBottom: `1px solid ${color}30`,
            }}
          >
            <div className="flex items-center gap-2">
              {/* Status indicator */}
              <div className="relative flex items-center gap-1">
                <span
                  className="block w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                />
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: color }}>
                  LIVE
                </span>
              </div>
              <span className="text-xs text-white/50">|</span>
              <span
                className="text-sm font-bold tracking-wider uppercase"
                style={{ color: "white", textShadow: `0 0 10px ${color}` }}
              >
                {agentName}
              </span>
            </div>

            {/* Audio visualizer */}
            <div className="flex items-center gap-0.5 h-3">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 rounded-full animate-pulse"
                  style={{
                    backgroundColor: color,
                    height: `${30 + Math.sin(i * 1.2) * 40}%`,
                    animationDelay: `${i * 80}ms`,
                    animationDuration: "0.4s",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Content area */}
          <div
            ref={containerRef}
            className="px-4 py-3 max-h-[180px] overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <p className="text-sm text-gray-100 leading-relaxed font-light">
              {displayText}
              <span
                className="inline-block w-0.5 h-4 ml-1 animate-pulse"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
              />
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative h-0.5" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="absolute inset-y-0 left-0 transition-all duration-150 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${color}60, ${color})`,
                boxShadow: `0 0 10px ${color}60`,
              }}
            />
          </div>

          {/* Corner cut decoration */}
          <div
            className="absolute bottom-0 right-0 w-3 h-3"
            style={{
              background: `linear-gradient(135deg, transparent 50%, ${color}30 50%)`,
            }}
          />
        </div>

        {/* Data readout below */}
        <div className="mt-2 flex items-center gap-4 text-[10px] font-mono" style={{ color: `${color}80` }}>
          <span>WORD {wordIndex}/{words.length}</span>
          <span>|</span>
          <span>{Math.round(progress)}% COMPLETE</span>
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

// Contextual reaction categories
const REACTION_CATEGORIES = {
  agree: [
    "I agree! 👍",
    "Good point! ✓",
    "Exactly! 💯",
    "Well said! 👏",
    "Valid point! ✨",
  ],
  disagree: [
    "I disagree 🙅",
    "Not quite... 🤔",
    "Debatable... 🤨",
    "I see it differently 🔄",
    "Counter-point coming... ⚡",
  ],
  thinking: [
    "Interesting... 🤔",
    "Let me think... 💭",
    "Considering... 🧐",
    "Hmm... 💡",
    "Processing... ⚙️",
  ],
  challenge: [
    "But what about... 🔍",
    "Evidence? 📊",
    "Sources? 📚",
    "Prove it! 🎯",
    "Citation needed 📝",
  ],
  impressed: [
    "Compelling! ✨",
    "Strong point! 💪",
    "Insightful! 🌟",
    "Well researched! 📖",
    "Good analysis! 📈",
  ],
  skeptical: [
    "Really? 🤨",
    "Not convinced... 🧐",
    "Needs more... 📋",
    "Oversimplified? 🔬",
    "Missing context... 📦",
  ],
};

// Get a contextual reaction based on argument content
function getContextualReaction(argumentContent: string, agentName: string): string {
  const content = argumentContent.toLowerCase();

  // Detect various patterns in the argument
  const hasAgreement = /agree|correct|right|indeed|exactly|absolutely/i.test(content);
  const hasDisagreement = /disagree|however|but|wrong|incorrect|actually/i.test(content);
  const hasQuestion = /\?|what|how|why|when|where/i.test(content);
  const hasEvidence = /research|study|data|evidence|source|according/i.test(content);
  const hasStrong = /must|critical|essential|important|crucial|vital/i.test(content);
  const hasCautious = /risk|concern|careful|caution|warning|danger/i.test(content);

  // Weight the reaction categories based on content
  const weights: { category: keyof typeof REACTION_CATEGORIES; weight: number }[] = [
    { category: "agree", weight: hasAgreement ? 3 : 1 },
    { category: "disagree", weight: hasDisagreement ? 3 : (hasStrong ? 2 : 1) },
    { category: "thinking", weight: hasQuestion ? 2 : 1 },
    { category: "challenge", weight: hasEvidence ? 0.5 : (hasQuestion ? 2 : 1.5) },
    { category: "impressed", weight: hasEvidence ? 3 : (hasStrong ? 2 : 0.5) },
    { category: "skeptical", weight: hasCautious ? 2 : (hasStrong ? 1.5 : 1) },
  ];

  // Normalize weights and pick randomly weighted
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { category, weight } of weights) {
    random -= weight;
    if (random <= 0) {
      const reactions = REACTION_CATEGORIES[category];
      return reactions[Math.floor(Math.random() * reactions.length)];
    }
  }

  // Fallback
  return REACTION_CATEGORIES.thinking[Math.floor(Math.random() * REACTION_CATEGORIES.thinking.length)];
}

// Reaction bubble component for waiting agents
function ReactionBubble({
  color,
  index,
  hasArguments,
  currentArgumentContent,
  agentName,
}: {
  color: string;
  index: number;
  hasArguments: boolean;
  currentArgumentContent?: string;
  agentName: string;
}) {
  const [reaction, setReaction] = useState("");
  const [visible, setVisible] = useState(false);
  const lastArgumentRef = useRef<string>("");

  useEffect(() => {
    // Only show reactions if there are actual arguments to react to
    if (!hasArguments || !currentArgumentContent) {
      setVisible(false);
      return;
    }

    // Only react when the argument content changes
    if (currentArgumentContent === lastArgumentRef.current) {
      return;
    }
    lastArgumentRef.current = currentArgumentContent;

    // Show reaction with staggered delay based on index
    const delay = 500 + index * 800 + Math.random() * 500;
    const timeout = setTimeout(() => {
      // 60% chance to react to give variety
      if (Math.random() < 0.6) {
        const contextualReaction = getContextualReaction(currentArgumentContent, agentName);
        setReaction(contextualReaction);
        setVisible(true);

        // Hide after 2.5-4 seconds
        setTimeout(() => setVisible(false), 2500 + Math.random() * 1500);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [index, hasArguments, currentArgumentContent, agentName]);

  if (!visible || !hasArguments) return null;

  return (
    <Html center position={[0, 6, 4]} distanceFactor={40} style={{ pointerEvents: "none" }}>
      <div
        className="animate-bounce-in px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap"
        style={{
          background: `linear-gradient(135deg, ${color}90 0%, ${color}70 100%)`,
          color: "white",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          boxShadow: `0 4px 15px ${color}50`,
          animation: "bounceIn 0.3s ease-out",
        }}
      >
        {reaction}
      </div>
    </Html>
  );
}

// Small waiting agent face
function WaitingAgentFace({
  agent,
  facePositions,
  position,
  index,
  total,
  isSomeoneSpeaking,
  argumentCount,
  currentArgumentContent,
}: {
  agent: Agent;
  facePositions: Float32Array;
  position: [number, number, number];
  index: number;
  total: number;
  isSomeoneSpeaking: boolean;
  argumentCount: number;
  currentArgumentContent?: string;
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

      {/* Reaction bubble when someone else is speaking AND there are arguments to react to */}
      {isSomeoneSpeaking && argumentCount > 0 && (
        <ReactionBubble
          color={agent.color}
          index={index}
          hasArguments={argumentCount > 0}
          currentArgumentContent={currentArgumentContent}
          agentName={agent.name}
        />
      )}

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

  const morphTo = useCallback((targetPositions: Float32Array, color: string, duration: number = 1.0) => {
    if (!pointsRef.current) return;

    // Kill any existing transitions to allow interruption
    gsap.killTweensOf(pointsRef.current.geometry.attributes.position.array);

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

  // Handle agent on stage changes (thinking or speaking)
  useEffect(() => {
    if (agent && facePositions && agent.id !== currentTarget) {
      // Agent is on stage - morph to their face (faster for responsive transitions)
      morphTo(facePositions, agent.color, 1.0);
      setCurrentTarget(agent.id);
    } else if (!agent && currentTarget) {
      // No agent on stage - return to cloud
      morphTo(cloudPositions, "#0066aa", 0.8);
      setCurrentTarget(null);
    }
  }, [agent, facePositions, currentTarget, morphTo, cloudPositions]);

  // Pointer tracking (supports both mouse and touch)
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handlePointerLeave = () => {
      mouse.current.set(-100, -100);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        mouse.current.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.current.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      }
    };

    const handleTouchEnd = () => {
      mouse.current.set(-100, -100);
    };

    // Use pointer events for unified handling
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    // Touch events as fallback for older browsers
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
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
      {/* Holographic HUD frame when agent is on stage */}
      {agent && <HolographicHUD color={agent.color} />}

      <points ref={pointsRef} geometry={geometry}>
        <primitive object={material} ref={materialRef} attach="material" />
      </points>

      {/* Agent name badge - sleek sci-fi style */}
      {agent && (
        <Html center position={[0, -8, 8]} distanceFactor={40} style={{ pointerEvents: "none" }}>
          <div className="flex flex-col items-center gap-1">
            {/* Name with tech styling */}
            <div
              className="px-4 py-1.5 rounded"
              style={{
                background: `linear-gradient(90deg, transparent, ${agent.color}15, transparent)`,
                borderBottom: `2px solid ${agent.color}`,
              }}
            >
              <span
                className="text-base font-bold tracking-[0.3em] uppercase whitespace-nowrap"
                style={{
                  color: "white",
                  textShadow: `0 0 15px ${agent.color}, 0 0 30px ${agent.color}50`,
                }}
              >
                {agent.name}
              </span>
            </div>
            {/* Status indicator */}
            <span
              className="text-[10px] font-mono tracking-widest uppercase"
              style={{ color: agent.color, opacity: 0.7 }}
            >
              {isSpeaking ? "● TRANSMITTING" : "● PROCESSING"}
            </span>
          </div>
        </Html>
      )}

      {/* Speech particles */}
      {agent && isSpeaking && (
        <SpeechParticles color={agent.color} isActive={true} />
      )}

      {/* Teleprompter - now positioned to the side */}
      {agent && isSpeaking && currentArgument && (
        <TeleprompterText text={currentArgument.content} agentName={agent.name} color={agent.color} />
      )}
    </>
  );
}

// ============================================================================
// ARENA FLOOR - Circular reactive grid
// ============================================================================
function ArenaFloor({ intensity = 0.3 }: { intensity?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uColor: { value: new THREE.Color("#00aaff") },
      },
      vertexShader: arenaFloorVertex,
      fragmentShader: arenaFloorFragment,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
      materialRef.current.uniforms.uIntensity.value = intensity;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -18, 0]}>
      <circleGeometry args={[50, 64]} />
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
}

// ============================================================================
// ENERGY ARCS - Lightning between disagreeing agents
// ============================================================================
function EnergyArc({
  start,
  end,
  color,
  intensity = 0.5
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  intensity?: number;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const [points, setPoints] = useState<THREE.Vector3[]>([]);

  useEffect(() => {
    // Create curved path with control points
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    mid.y += 5; // Arc upward

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    setPoints(curve.getPoints(20));
  }, [start, end]);

  useFrame(({ clock }) => {
    if (lineRef.current && points.length > 0) {
      // Animate the arc with noise
      const positions = lineRef.current.geometry.attributes.position.array as Float32Array;
      const time = clock.elapsedTime;

      for (let i = 0; i < points.length; i++) {
        const t = i / points.length;
        const noise = Math.sin(t * 20 + time * 8) * intensity * 0.5;
        const noiseX = Math.cos(t * 15 + time * 5) * intensity * 0.3;

        positions[i * 3] = points[i].x + noiseX;
        positions[i * 3 + 1] = points[i].y + noise;
        positions[i * 3 + 2] = points[i].z;
      }
      lineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (points.length === 0) return null;

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={intensity * 0.8}
        linewidth={2}
      />
    </line>
  );
}

// ============================================================================
// TENSION FIELD - Visual energy between agents during conflict
// ============================================================================
function TensionField({
  agents,
  speakingAgentId,
  tensionLevel = 0.3
}: {
  agents: Agent[];
  speakingAgentId?: string;
  tensionLevel?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Calculate agent positions (same as waiting positions)
  const getAgentPosition = (index: number, total: number): THREE.Vector3 => {
    const spacing = Math.min(16, 50 / total);
    const startX = -((total - 1) * spacing) / 2;
    return new THREE.Vector3(startX + index * spacing, -12, 15);
  };

  // Only show tension when there's active debate
  if (!speakingAgentId || tensionLevel < 0.1) return null;

  return (
    <group ref={groupRef}>
      {agents.map((agent, i) => {
        if (agent.id === speakingAgentId) return null;

        // Draw arc from speaking agent to this waiting agent
        const speakerIndex = agents.findIndex(a => a.id === speakingAgentId);
        if (speakerIndex === -1) return null;

        const speakerPos = new THREE.Vector3(0, 0, 0); // Center stage
        const waitingPos = getAgentPosition(
          i > speakerIndex ? i - 1 : i,
          agents.length - 1
        );

        return (
          <EnergyArc
            key={agent.id}
            start={speakerPos}
            end={waitingPos}
            color={agent.color}
            intensity={tensionLevel * 0.5}
          />
        );
      })}
    </group>
  );
}

// ============================================================================
// AGENT AURA - Floating symbols around agent
// ============================================================================
function AgentAura({ agentId, color, isActive }: { agentId: string; color: string; isActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const signature = AGENT_SIGNATURES[agentId] || AGENT_SIGNATURES.default;

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.3;
    }
  });

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      {signature.symbols.map((symbol, i) => {
        const angle = (i / signature.symbols.length) * Math.PI * 2;
        const radius = 12;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(angle * 2) * 2;

        return (
          <Html
            key={i}
            position={[x, y, z]}
            center
            distanceFactor={60}
            style={{ pointerEvents: "none" }}
          >
            <span
              className="text-2xl animate-float"
              style={{
                filter: `drop-shadow(0 0 10px ${color})`,
                animationDelay: `${i * 0.2}s`,
              }}
            >
              {symbol}
            </span>
          </Html>
        );
      })}
    </group>
  );
}

// ============================================================================
// CINEMATIC CAMERA CONTROLLER
// ============================================================================
function CinematicCamera({
  speakingAgentId,
  status
}: {
  speakingAgentId?: string;
  status?: DebateStatus;
}) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 0, 45));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (status === "complete") {
      // Pull back for summary view
      targetPosition.current.set(0, 5, 55);
      targetLookAt.current.set(0, 0, 0);
    } else if (speakingAgentId) {
      // Zoom in slightly when someone is speaking
      targetPosition.current.set(2, 2, 40);
      targetLookAt.current.set(0, 2, 0);
    } else {
      // Default wide view
      targetPosition.current.set(0, 0, 45);
      targetLookAt.current.set(0, 0, 0);
    }
  }, [speakingAgentId, status]);

  useFrame(() => {
    // Smooth camera movement
    camera.position.lerp(targetPosition.current, 0.02);

    // Calculate current look-at and lerp
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    currentLookAt.multiplyScalar(10).add(camera.position);
    currentLookAt.lerp(targetLookAt.current, 0.02);
  });

  return null;
}

// ============================================================================
// SPECTATOR ORBS - Floating audience that reacts
// ============================================================================
function SpectatorOrbs({ argumentCount = 0 }: { argumentCount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const orbCount = 30;

  const orbs = useMemo(() => {
    return Array.from({ length: orbCount }, (_, i) => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 40 + 10,
        -20 - Math.random() * 30
      ),
      scale: 0.3 + Math.random() * 0.5,
      speed: 0.5 + Math.random() * 0.5,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const orb = orbs[i];
        child.position.y = orb.position.y + Math.sin(clock.elapsedTime * orb.speed + i) * 2;
        child.position.x = orb.position.x + Math.cos(clock.elapsedTime * orb.speed * 0.5 + i) * 1;

        // Pulse brighter when there are more arguments (more excitement)
        const intensity = 0.2 + Math.min(argumentCount * 0.05, 0.5);
        (child as THREE.Mesh).material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.55 + Math.sin(i) * 0.1, 0.8, intensity),
          transparent: true,
          opacity: 0.4 + intensity * 0.3,
        });
      });
    }
  });

  return (
    <group ref={groupRef}>
      {orbs.map((orb, i) => (
        <mesh key={i} position={orb.position} scale={orb.scale}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#4488ff" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// VERDICT PARTICLES - Dramatic conclusion effect
// ============================================================================
function VerdictEffect({ isActive, consensus = 50 }: { isActive: boolean; consensus?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(500 * 3);
    const colors = new Float32Array(500 * 3);

    for (let i = 0; i < 500; i++) {
      // Start from random positions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 30 + Math.random() * 20;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Color based on consensus (green = high, orange = low)
      const hue = consensus > 60 ? 0.3 : consensus > 40 ? 0.15 : 0.05;
      const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [consensus]);

  useFrame(({ clock }) => {
    if (particlesRef.current && isActive) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      const time = clock.elapsedTime;

      for (let i = 0; i < 500; i++) {
        const i3 = i * 3;
        // Spiral inward
        const currentR = Math.sqrt(
          positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2
        );
        const targetR = Math.max(2, currentR - 0.3);
        const scale = targetR / currentR;

        positions[i3] *= scale;
        positions[i3 + 1] *= scale;
        positions[i3 + 2] *= scale;

        // Add rotation
        const angle = 0.02;
        const x = positions[i3];
        const z = positions[i3 + 2];
        positions[i3] = x * Math.cos(angle) - z * Math.sin(angle);
        positions[i3 + 2] = x * Math.sin(angle) + z * Math.cos(angle);
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      <points ref={particlesRef} geometry={geometry}>
        <pointsMaterial
          size={3}
          vertexColors
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
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

// Floating data HUD on left side
function DataHUD({ agents, currentRound, argumentCount, speakingAgent }: {
  agents: Agent[];
  currentRound: number;
  argumentCount: number;
  speakingAgent?: Agent;
}) {
  return (
    <Html position={[-28, 5, 0]} distanceFactor={50} style={{ width: "180px", pointerEvents: "none" }}>
      <div
        className="font-mono text-[11px] space-y-3"
        style={{ color: "rgba(100, 200, 255, 0.7)" }}
      >
        {/* System status */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest opacity-50">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            System Status
          </div>
          <div className="pl-3 space-y-0.5 border-l border-cyan-500/20">
            <div className="flex justify-between">
              <span className="opacity-50">Round</span>
              <span className="text-cyan-300">{currentRound || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-50">Arguments</span>
              <span className="text-cyan-300">{argumentCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-50">Agents</span>
              <span className="text-cyan-300">{agents.length}</span>
            </div>
          </div>
        </div>

        {/* Active agents */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-widest opacity-50">
            Participants
          </div>
          <div className="space-y-1">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-2 px-2 py-0.5 rounded"
                style={{
                  background: speakingAgent?.id === agent.id ? `${agent.color}20` : "transparent",
                  borderLeft: speakingAgent?.id === agent.id ? `2px solid ${agent.color}` : "2px solid transparent",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: agent.color,
                    boxShadow: speakingAgent?.id === agent.id ? `0 0 6px ${agent.color}` : "none",
                  }}
                />
                <span
                  className="truncate text-[10px]"
                  style={{ color: speakingAgent?.id === agent.id ? agent.color : "rgba(255,255,255,0.5)" }}
                >
                  {agent.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Html>
  );
}

// Orbital rings around the scene
function OrbitalRings() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.x = clock.elapsedTime * 0.05;
      groupRef.current.rotation.y = clock.elapsedTime * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[30, 0.05, 16, 100]} />
        <meshBasicMaterial color="#0066aa" transparent opacity={0.15} />
      </mesh>
      <mesh rotation={[Math.PI / 2.5, Math.PI / 4, 0]}>
        <torusGeometry args={[35, 0.03, 16, 100]} />
        <meshBasicMaterial color="#00aaff" transparent opacity={0.1} />
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

  // Show agent on stage if they're speaking OR thinking
  const stageAgentId = props.speakingAgentId || props.thinkingAgentId;
  const stageAgent = props.agents.find(a => a.id === stageAgentId);
  const isSpeaking = !!props.speakingAgentId && !!props.currentArgument;
  const waitingAgents = props.agents.filter(a => a.id !== stageAgentId);

  // Get current round from latest argument
  const currentRound = props.arguments?.length ? props.arguments[props.arguments.length - 1].round : 1;
  const argumentCount = props.arguments?.length || 0;

  // Calculate debate intensity (increases over time)
  const debateIntensity = Math.min(0.3 + argumentCount * 0.1, 0.9);

  // Calculate waiting agent positions at bottom - visible in camera view
  const getWaitingPosition = (index: number, total: number): [number, number, number] => {
    if (total === 0) return [0, 0, 0];
    const spacing = Math.min(16, 50 / total);
    const startX = -((total - 1) * spacing) / 2;
    return [startX + index * spacing, -12, 15];
  };

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 20, 10]} intensity={0.5} color="#00aaff" />

      {/* Cinematic camera controller */}
      <CinematicCamera speakingAgentId={props.speakingAgentId} status={props.status} />

      {/* Arena floor with reactive grid */}
      <ArenaFloor intensity={debateIntensity} />

      {/* Atmospheric elements */}
      <AmbientParticles />
      <OrbitalRings />
      <SpectatorOrbs argumentCount={argumentCount} />

      {/* Tension visualization between agents */}
      {props.status === "debating" && (
        <TensionField
          agents={props.agents}
          speakingAgentId={props.speakingAgentId}
          tensionLevel={debateIntensity}
        />
      )}

      {/* Data HUD on left */}
      {props.status === "debating" && (
        <DataHUD
          agents={props.agents}
          currentRound={currentRound}
          argumentCount={argumentCount}
          speakingAgent={stageAgent}
        />
      )}

      {/* Main face on stage - shows for thinking or speaking agent */}
      <MainSpeakingFace
        agent={stageAgent || null}
        facePositions={faceData?.large || null}
        cloudPositions={cloudPositions}
        isSpeaking={isSpeaking}
        currentArgument={props.currentArgument}
      />

      {/* Agent aura - floating symbols */}
      {stageAgent && (
        <AgentAura
          agentId={stageAgent.id}
          color={stageAgent.color}
          isActive={isSpeaking}
        />
      )}

      {/* Waiting agents at bottom */}
      {faceData && waitingAgents.map((agent, index) => (
        <WaitingAgentFace
          key={agent.id}
          agent={agent}
          facePositions={faceData.small}
          position={getWaitingPosition(index, waitingAgents.length)}
          index={index}
          total={waitingAgents.length}
          isSomeoneSpeaking={isSpeaking}
          argumentCount={argumentCount}
          currentArgumentContent={props.currentArgument?.content}
        />
      ))}

      {/* Verdict effect when concluding/complete */}
      <VerdictEffect
        isActive={props.status === "concluding" || props.status === "complete"}
        consensus={props.summary?.consensus}
      />
    </>
  );
}

export function DebateScene(props: DebateSceneProps) {
  return (
    <div className="absolute inset-0 bg-[var(--scene-bg)]" style={{ touchAction: "none" }}>
      <Canvas
        camera={{ position: [0, 0, 45], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#030014"]} />
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>


      {/* Status Indicator - Sci-fi HUD style */}
      {props.status && props.status !== "idle" && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
          {/* Loading/Connecting */}
          {props.status === "loading" && (
            <div
              className="relative px-6 py-2 font-mono"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(0,200,255,0.1), transparent)",
                borderTop: "1px solid rgba(0,200,255,0.3)",
                borderBottom: "1px solid rgba(0,200,255,0.3)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-4 bg-cyan-400 animate-pulse"
                      style={{
                        animationDelay: `${i * 100}ms`,
                        opacity: 0.3 + (i * 0.15),
                      }}
                    />
                  ))}
                </div>
                <span className="text-cyan-400 text-xs tracking-[0.2em] uppercase">
                  ESTABLISHING CONNECTION
                </span>
                <div className="flex gap-1">
                  {[4, 3, 2, 1, 0].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-4 bg-cyan-400 animate-pulse"
                      style={{
                        animationDelay: `${i * 100}ms`,
                        opacity: 0.3 + (i * 0.15),
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Agent Thinking */}
          {props.status === "debating" && props.thinkingAgentId && !props.currentArgument && (() => {
            const thinkingAgent = props.agents.find(a => a.id === props.thinkingAgentId);
            const agentColor = thinkingAgent?.color || "#ffcc00";
            return (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="relative px-5 py-2 font-mono"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${agentColor}10, transparent)`,
                    borderTop: `1px solid ${agentColor}40`,
                    borderBottom: `1px solid ${agentColor}40`,
                  }}
                >
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: agentColor }} />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: agentColor }} />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l" style={{ borderColor: agentColor }} />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: agentColor }} />

                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: agentColor, boxShadow: `0 0 10px ${agentColor}` }}
                    />
                    <span className="text-xs tracking-[0.15em] uppercase" style={{ color: agentColor }}>
                      {thinkingAgent?.name || "Agent"} // PROCESSING
                    </span>
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{
                            backgroundColor: agentColor,
                            animationDelay: `${i * 150}ms`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Tool indicator */}
                {props.currentTool && (
                  <div
                    className="flex items-center gap-2 px-3 py-1 font-mono text-[10px]"
                    style={{
                      background: "rgba(168,85,247,0.1)",
                      borderLeft: "2px solid rgba(168,85,247,0.6)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                    <span className="text-purple-300 tracking-wider uppercase">
                      {formatToolName(props.currentTool.name)}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Agent Speaking - minimal, since teleprompter shows details */}
          {props.status === "debating" && props.speakingAgentId && props.currentArgument && (() => {
            const agent = props.agents.find(a => a.id === props.speakingAgentId);
            return (
              <div
                className="flex items-center gap-3 px-4 py-1.5 font-mono"
                style={{
                  background: `linear-gradient(90deg, transparent, ${agent?.color || "#00ff00"}08, transparent)`,
                }}
              >
                <div className="flex gap-0.5 items-end h-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full animate-pulse"
                      style={{
                        backgroundColor: agent?.color,
                        height: `${40 + Math.sin(i * 1.5) * 40}%`,
                        animationDelay: `${i * 80}ms`,
                        animationDuration: "0.4s",
                      }}
                    />
                  ))}
                </div>
                <span
                  className="text-[10px] tracking-[0.2em] uppercase"
                  style={{ color: agent?.color }}
                >
                  LIVE TRANSMISSION
                </span>
                <div className="flex gap-0.5 items-end h-3">
                  {[4, 3, 2, 1, 0].map((i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full animate-pulse"
                      style={{
                        backgroundColor: agent?.color,
                        height: `${40 + Math.sin(i * 1.5) * 40}%`,
                        animationDelay: `${i * 80}ms`,
                        animationDuration: "0.4s",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Concluding */}
          {props.status === "concluding" && (
            <div
              className="relative px-5 py-2 font-mono"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.1), transparent)",
                borderTop: "1px solid rgba(168,85,247,0.3)",
                borderBottom: "1px solid rgba(168,85,247,0.3)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ boxShadow: "0 0 10px #a855f7" }} />
                <span className="text-purple-300 text-xs tracking-[0.15em] uppercase">
                  SYNTHESIZING RESULTS
                </span>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Complete - just show small badge, summary overlay handles the rest */}
          {props.status === "complete" && !props.summary && (
            <div
              className="flex items-center gap-3 px-4 py-1.5 font-mono"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.1), transparent)",
                borderTop: "1px solid rgba(34,197,94,0.3)",
                borderBottom: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: "0 0 10px #22c55e" }} />
              <span className="text-green-400 text-xs tracking-[0.15em] uppercase">TRANSMISSION COMPLETE</span>
            </div>
          )}
        </div>
      )}

      {/* Summary Overlay - Shows when debate is complete */}
      {props.status === "complete" && props.summary && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-8">
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl animate-fade-in"
            style={{
              background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
              border: "1px solid rgba(34, 211, 238, 0.2)",
              boxShadow: "0 0 80px rgba(34, 211, 238, 0.15), 0 25px 50px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Header */}
            <div
              className="p-6 border-b border-cyan-500/20"
              style={{
                background: "linear-gradient(90deg, rgba(34, 211, 238, 0.1) 0%, transparent 50%, rgba(34, 211, 238, 0.1) 100%)",
              }}
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
                <h2 className="text-2xl font-bold text-white tracking-wide">Debate Complete</h2>
                <span className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
              </div>
              {props.task && (
                <p className="text-center text-cyan-300/70 text-sm">{props.task}</p>
              )}
            </div>

            {/* Consensus Meter */}
            <div className="p-6 border-b border-white/5">
              <div className="text-center mb-4">
                <span className="text-sm font-medium text-cyan-300 uppercase tracking-widest">Consensus Level</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden bg-white/5">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${props.summary.consensus}%`,
                    background: props.summary.consensus >= 70
                      ? "linear-gradient(90deg, #22c55e, #4ade80)"
                      : props.summary.consensus >= 40
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)",
                    boxShadow: props.summary.consensus >= 70
                      ? "0 0 20px rgba(34, 197, 94, 0.5)"
                      : props.summary.consensus >= 40
                      ? "0 0 20px rgba(245, 158, 11, 0.5)"
                      : "0 0 20px rgba(239, 68, 68, 0.5)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/50">
                <span>Divided</span>
                <span className="text-lg font-bold text-white">{props.summary.consensus}%</span>
                <span>Unified</span>
              </div>
            </div>

            {/* Key Points */}
            <div className="p-6 space-y-6">
              {/* Agreements */}
              {props.summary.keyAgreements.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-green-400 font-semibold mb-3">
                    <span className="text-lg">✓</span> Key Agreements
                  </h3>
                  <ul className="space-y-2">
                    {props.summary.keyAgreements.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/80">
                        <span className="text-green-400/50">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disagreements */}
              {props.summary.keyDisagreements.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-orange-400 font-semibold mb-3">
                    <span className="text-lg">✗</span> Key Disagreements
                  </h3>
                  <ul className="space-y-2">
                    {props.summary.keyDisagreements.map((point, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/80">
                        <span className="text-orange-400/50">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              <div
                className="p-4 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(34, 211, 238, 0.05) 100%)",
                  border: "1px solid rgba(34, 211, 238, 0.2)",
                }}
              >
                <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-2">
                  <span className="text-lg">💡</span> Recommendation
                </h3>
                <p className="text-white/90 text-sm leading-relaxed">{props.summary.recommendation}</p>
              </div>

              {/* Reasoning (collapsible feel) */}
              {props.summary.reasoning && (
                <div className="pt-2">
                  <h3 className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Reasoning</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{props.summary.reasoning}</p>
                </div>
              )}
            </div>

            {/* Footer with action */}
            <div className="p-6 border-t border-white/5">
              <button
                onClick={props.onReset}
                className="w-full py-3 px-6 rounded-xl font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)",
                  boxShadow: "0 4px 20px rgba(14, 165, 233, 0.3)",
                }}
              >
                Start New Debate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
