# Debate Arena - Complete Technical Recreation Guide

**Version:** 1.0
**Date:** February 2026
**Purpose:** Enable complete recreation of the Debate Arena application with all visual effects

---

# TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [THE KILLER FEATURE: Particle Face System](#4-the-killer-feature-particle-face-system)
5. [3D Scene Architecture](#5-3d-scene-architecture)
6. [Creative Visual Effects](#6-creative-visual-effects)
7. [Debate Flow System](#7-debate-flow-system)
8. [LLM Integration](#8-llm-integration)
9. [State Management](#9-state-management)
10. [API Routes](#10-api-routes)
11. [Configuration Files](#11-configuration-files)
12. [CSS and Animations](#12-css-and-animations)
13. [Audio System](#13-audio-system)
14. [Step-by-Step Recreation](#14-step-by-step-recreation)
15. [Troubleshooting](#15-troubleshooting)

---

# 1. EXECUTIVE SUMMARY

Debate Arena is a real-time AI debate visualization platform where multiple AI agents debate topics. The standout feature is a **3D particle-based humanoid face** that morphs between agents, created using Three.js with custom GLSL shaders.

## Key Features:
- 3D particle faces that morph between different AI agents
- Real-time debate streaming via Server-Sent Events (SSE)
- Multiple LLM provider support (Ollama, OpenAI, Claude, Gemini)
- Cinematic camera movements
- Audio landscape
- Agent memory and learning
- Debate history and replay

## The "Magic" - What Makes This Special:
1. **OBJ Model Loading** - Load a 3D face model file
2. **Surface Sampling** - Sample 15,000 points on the mesh surface
3. **GSAP Morphing** - Smoothly animate between positions
4. **Custom Shaders** - Mouse interaction and particle effects
5. **Color Transitions** - Agent-specific colors during morph

---

# 2. TECHNOLOGY STACK

```json
{
  "framework": "Next.js 15 (App Router)",
  "language": "TypeScript",
  "3d": {
    "renderer": "Three.js",
    "react-binding": "@react-three/fiber",
    "helpers": "@react-three/drei",
    "animation": "GSAP"
  },
  "styling": "Tailwind CSS 4",
  "llm": {
    "local": "Ollama",
    "cloud": ["OpenAI", "Anthropic Claude", "Google Gemini"]
  },
  "state": "React Context + SSE streaming"
}
```

## Package.json Dependencies (Critical):

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.170.0",
    "@react-three/fiber": "^8.17.0",
    "@react-three/drei": "^9.117.0",
    "gsap": "^3.12.0",
    "lucide-react": "^0.400.0"
  }
}
```

---

# 3. PROJECT STRUCTURE

```
debate-arena/
├── app/
│   ├── api/
│   │   ├── debate/
│   │   │   ├── start/route.ts          # Start debate
│   │   │   ├── [debateId]/
│   │   │   │   ├── route.ts            # Get/control debate
│   │   │   │   ├── events/route.ts     # SSE stream
│   │   │   │   └── collab/route.ts     # Collaboration
│   │   ├── agents/route.ts             # Agent config
│   │   ├── settings/
│   │   │   ├── llm/route.ts            # LLM settings
│   │   │   └── tools/route.ts          # Tool config
│   │   └── debates/                    # History
│   ├── debate/page.tsx                 # Main debate page
│   ├── history/                        # Replay pages
│   ├── configure/page.tsx              # Settings
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── visualization-3d/
│   │   └── DebateScene.tsx             # ⭐ THE MAIN FILE
│   ├── arena/
│   │   └── DebateArena.tsx
│   └── ...
├── lib/
│   ├── agents/
│   │   ├── debate-agent.ts
│   │   ├── moderator-agent.ts
│   │   └── types.ts
│   ├── llm/
│   │   ├── client.ts
│   │   └── providers/
│   ├── events/
│   │   └── emitter.ts
│   └── state/
│       └── debate-state.ts
├── hooks/
│   ├── useDebateStream.ts
│   └── useDebateAudio.ts
├── contexts/
│   └── DebateContext.tsx
├── config/
│   ├── agents.json
│   └── llm.json
├── public/
│   └── models/
│       └── face2.obj                   # ⭐ CRITICAL: 3D face model
└── data/
    ├── debates/
    └── agent-memories/
```

---

# 4. THE KILLER FEATURE: PARTICLE FACE SYSTEM

This is the most important section. The particle face system creates a humanoid face from 15,000 particles that can morph between different agents with different colors.

## 4.1 Required 3D Model

You need a 3D face model in OBJ format. Place it at `/public/models/face2.obj`.

**Recommended sources:**
- TurboSquid (search "head bust obj")
- Sketchfab (filter by OBJ format)
- Create in Blender and export as OBJ

**Model requirements:**
- OBJ format (not GLB/GLTF)
- Clean mesh with good topology
- ~5,000-50,000 vertices
- Single mesh (not multiple objects)

## 4.2 Core Constants

```typescript
const PARTICLE_COUNT = 15000;        // Main speaking face
const SMALL_PARTICLE_COUNT = 8000;   // Waiting agents (smaller)
const FACE_MODEL = "/models/face2.obj";
```

## 4.3 The Vertex Shader (Mouse Interaction)

This shader makes particles react to mouse movement:

```glsl
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
```

## 4.4 The Fragment Shader (Particle Rendering)

```glsl
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
```

## 4.5 Loading the OBJ Model

```typescript
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

// Cache for performance
let cachedFacePositions: Float32Array | null = null;
let cachedSmallFacePositions: Float32Array | null = null;

async function loadFaceModel(): Promise<{ large: Float32Array; small: Float32Array } | null> {
  // Return cached if available
  if (cachedFacePositions && cachedSmallFacePositions) {
    return { large: cachedFacePositions, small: cachedSmallFacePositions };
  }

  return new Promise((resolve) => {
    const loader = new OBJLoader();
    loader.load(
      FACE_MODEL,
      (obj) => {
        let mesh: THREE.Mesh | null = null;

        // Find the mesh with most vertices
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const childMesh = child as THREE.Mesh;
            if (!mesh || (childMesh.geometry.attributes.position?.count >
                (mesh.geometry.attributes.position?.count || 0))) {
              mesh = childMesh.clone();
            }
          }
        });

        if (mesh) {
          // Create large version for main speaker
          const largeMesh = mesh.clone();
          normalizeMesh(largeMesh, 20);  // Scale to size 20
          cachedFacePositions = samplePointsOnSurface(largeMesh, PARTICLE_COUNT);

          // Create smaller version for waiting agents
          const smallMesh = mesh.clone();
          normalizeMesh(smallMesh, 9);   // Scale to size 9
          cachedSmallFacePositions = samplePointsOnSurface(smallMesh, SMALL_PARTICLE_COUNT);

          resolve({ large: cachedFacePositions, small: cachedSmallFacePositions });
        } else {
          resolve(null);
        }
      },
      undefined,
      () => resolve(null)  // Error handler
    );
  });
}
```

## 4.6 Normalizing the Mesh (Critical!)

This ensures the face is centered and properly sized:

```typescript
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
  mesh.geometry.center();  // Center at origin
}
```

## 4.7 Sampling Points on Surface (The Magic!)

This is what creates the particle positions from the 3D model:

```typescript
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
    // Fallback: use vertex positions directly
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
```

## 4.8 Creating the Cloud (Idle State)

When no agent is speaking, particles form an ambient cloud:

```typescript
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
```

## 4.9 The Morph Function (THE CRITICAL 10 LINES!)

This is the function that makes the magic happen - morphing from cloud to face or between faces:

```typescript
const morphTo = useCallback((targetPositions: Float32Array, color: string, duration: number = 1.0) => {
  if (!pointsRef.current) return;

  // ⭐ CRITICAL: Kill existing transitions to allow interruption
  gsap.killTweensOf(pointsRef.current.geometry.attributes.position.array);

  isTransitioning.current = true;
  const currentPositions = pointsRef.current.geometry.attributes.position.array as Float32Array;
  const mat = pointsRef.current.material as THREE.ShaderMaterial;

  // Animate color
  const targetColor = new THREE.Color(color);
  gsap.to(mat.uniforms.uColor.value, {
    duration,
    r: targetColor.r,
    g: targetColor.g,
    b: targetColor.b,
    ease: "power2.inOut",
  });

  // ⭐ CRITICAL: Animate positions using GSAP's endArray
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
```

## 4.10 The Complete MainSpeakingFace Component

```typescript
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

  // Create geometry with cloud positions initially
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(cloudPositions.slice(), 3));

    // Random values for shader variation
    const randoms = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      randoms[i] = Math.random();
    }
    geo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    return geo;
  }, [cloudPositions]);

  // Create shader material
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

  // The morph function (defined above)
  const morphTo = useCallback((targetPositions: Float32Array, color: string, duration: number = 1.0) => {
    // ... (code from section 4.9)
  }, []);

  // Handle agent changes - trigger morph
  useEffect(() => {
    if (agent && facePositions && agent.id !== currentTarget) {
      // Agent is on stage - morph to their face
      morphTo(facePositions, agent.color, 1.0);
      setCurrentTarget(agent.id);
    } else if (!agent && currentTarget) {
      // No agent on stage - return to cloud
      morphTo(cloudPositions, "#0066aa", 0.8);
      setCurrentTarget(null);
    }
  }, [agent, facePositions, currentTarget, morphTo, cloudPositions]);

  // Mouse tracking
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // Animation loop
  useFrame(() => {
    if (!pointsRef.current || !materialRef.current) return;

    timeRef.current += 0.016;
    const mat = materialRef.current;

    // Gentle rotation
    pointsRef.current.rotation.y = Math.sin(timeRef.current * 0.3) * 0.3;
    pointsRef.current.rotation.x = Math.sin(timeRef.current * 0.2) * 0.1;

    // Floating animation when in cloud state
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

    // Mouse interaction - convert screen to world coordinates
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

      {/* Agent name label */}
      {agent && (
        <Html center position={[0, -8, 8]} distanceFactor={40}>
          <span style={{
            color: "white",
            textShadow: `0 0 15px ${agent.color}`,
            fontWeight: "bold",
            letterSpacing: "0.3em",
          }}>
            {agent.name}
          </span>
        </Html>
      )}
    </>
  );
}
```

## 4.11 Waiting Agent Faces (Smaller versions)

```typescript
function WaitingAgentFace({
  agent,
  facePositions,
  position,
  index,
}: {
  agent: Agent;
  facePositions: Float32Array;
  position: [number, number, number];
  index: number;
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

    // Idle animation
    pointsRef.current.rotation.y = Math.sin(timeRef.current * 0.5 + index) * 0.15;

    // Breathing effect
    const pulse = 1 + Math.sin(timeRef.current * 2 + index * 0.5) * 0.05;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(pulse);
    }

    materialRef.current.uniforms.uTime.value = performance.now();
  });

  return (
    <group ref={groupRef} position={position}>
      <points ref={pointsRef} geometry={geometry}>
        <primitive object={material} ref={materialRef} attach="material" />
      </points>
    </group>
  );
}
```

---

# 5. 3D SCENE ARCHITECTURE

## 5.1 Canvas Setup

```typescript
export function DebateScene(props: DebateSceneProps) {
  return (
    <div className="absolute inset-0" style={{ touchAction: "none" }}>
      <Canvas
        camera={{ position: [0, 0, 45], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        }}
        dpr={[1, 2]}  // Responsive pixel ratio
      >
        <color attach="background" args={["#030014"]} />
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
```

## 5.2 Scene Component Structure

```typescript
function Scene(props: DebateSceneProps) {
  const [faceData, setFaceData] = useState<{...} | null>(null);
  const [cloudPositions] = useState(() => createCloudPositions(PARTICLE_COUNT));

  useEffect(() => {
    loadFaceModel().then(setFaceData);
  }, []);

  const stageAgentId = props.speakingAgentId || props.thinkingAgentId;
  const stageAgent = props.agents.find(a => a.id === stageAgentId);
  const waitingAgents = props.agents.filter(a => a.id !== stageAgentId);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 20, 10]} intensity={0.5} color="#00aaff" />

      {/* Arena floor */}
      <ArenaFloor intensity={debateIntensity} />

      {/* Atmospheric particles */}
      <AmbientParticles />

      {/* Main speaking face */}
      <MainSpeakingFace
        agent={stageAgent || null}
        facePositions={faceData?.large || null}
        cloudPositions={cloudPositions}
        isSpeaking={!!props.speakingAgentId}
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
        />
      ))}
    </>
  );
}
```

---

# 6. CREATIVE VISUAL EFFECTS

## 6.1 Arena Floor with Reactive Grid

```typescript
const arenaFloorVertex = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Wave effect
    float dist = length(uv - 0.5) * 2.0;
    float wave = sin(dist * 10.0 - uTime * 2.0) * 0.5 * uIntensity;
    pos.z += wave * (1.0 - dist);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const arenaFloorFragment = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0;

    // Circular fade
    float circleFade = 1.0 - smoothstep(0.8, 1.0, dist);

    // Grid pattern
    vec2 grid = abs(fract(centered * 20.0) - 0.5);
    float gridLine = min(grid.x, grid.y);
    float gridPattern = 1.0 - smoothstep(0.0, 0.05, gridLine);

    // Radial lines
    float angle = atan(centered.y, centered.x);
    float radialLines = abs(sin(angle * 12.0));
    float radialPattern = smoothstep(0.98, 1.0, radialLines) * 0.5;

    // Combine
    float pattern = gridPattern * 0.4 + radialPattern;
    pattern *= circleFade;

    vec3 color = uColor * (0.3 + pattern * 0.7);
    gl_FragColor = vec4(color, pattern * 0.6);
  }
`;

function ArenaFloor({ intensity = 0.3 }: { intensity?: number }) {
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -18, 0]}>
      <circleGeometry args={[50, 64]} />
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
}
```

## 6.2 Holographic HUD Frame

```typescript
function HolographicHUD({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Hexagonal frame */}
      <mesh rotation={[0, 0, Math.PI / 6]}>
        <ringGeometry args={[14, 14.3, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {/* Inner ring */}
      <mesh>
        <ringGeometry args={[12, 12.1, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}
```

## 6.3 Glow Rings Around Agents

```typescript
function GlowRing({ color, scale = 1 }: { color: string; scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = clock.elapsedTime * 0.3;
    }
  });

  return (
    <group ref={groupRef} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
      <mesh>
        <torusGeometry args={[4.5, 0.1, 16, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <mesh scale={0.85}>
        <torusGeometry args={[4.5, 0.05, 16, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}
```

## 6.4 Spectator Orbs (Floating Audience)

```typescript
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
```

## 6.5 Orbital Rings

```typescript
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
```

## 6.6 Cinematic Camera Controller

```typescript
function CinematicCamera({
  speakingAgentId,
  status
}: {
  speakingAgentId?: string;
  status?: string;
}) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 0, 45));

  useEffect(() => {
    if (status === "complete") {
      targetPosition.current.set(0, 5, 55);  // Pull back
    } else if (speakingAgentId) {
      targetPosition.current.set(2, 2, 40);  // Zoom in
    } else {
      targetPosition.current.set(0, 0, 45);  // Default
    }
  }, [speakingAgentId, status]);

  useFrame(() => {
    camera.position.lerp(targetPosition.current, 0.02);
  });

  return null;
}
```

---

# 7. DEBATE FLOW SYSTEM

## 7.1 Debate State Manager

```typescript
// lib/state/debate-state.ts

interface DebateState {
  id: string;
  status: "idle" | "debating" | "paused" | "complete" | "error";
  task: string;
  currentRound: number;
  arguments: DebateArgument[];
  speakingAgent?: string;
  summary?: DebateSummary;
}

class DebateStateManager {
  private states: Map<string, DebateState> = new Map();

  create(config: { id: string; task: string; activeAgents: string[] }): DebateState {
    const state: DebateState = {
      id: config.id,
      status: "idle",
      task: config.task,
      currentRound: 0,
      arguments: [],
    };
    this.states.set(config.id, state);
    return state;
  }

  get(debateId: string): DebateState | undefined {
    return this.states.get(debateId);
  }

  start(debateId: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "debating";
      state.currentRound = 1;
    }
  }

  addArgument(debateId: string, argument: DebateArgument) {
    const state = this.states.get(debateId);
    if (state) {
      state.arguments.push(argument);
    }
  }

  setSpeakingAgent(debateId: string, agentId?: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.speakingAgent = agentId;
    }
  }

  complete(debateId: string, summary: DebateSummary) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "complete";
      state.summary = summary;
    }
  }
}

// CRITICAL: Use globalThis for singleton in Next.js
const globalForDebate = globalThis as unknown as {
  debateStateManager: DebateStateManager | undefined;
};

export const debateStateManager =
  globalForDebate.debateStateManager ?? new DebateStateManager();

if (process.env.NODE_ENV !== "production") {
  globalForDebate.debateStateManager = debateStateManager;
}
```

## 7.2 Event Emitter for SSE

```typescript
// lib/events/emitter.ts

type EventCallback = (event: DebateEvent) => void;

class DebateEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private eventBuffer: Map<string, DebateEvent[]> = new Map();

  subscribe(debateId: string, callback: EventCallback): () => void {
    if (!this.listeners.has(debateId)) {
      this.listeners.set(debateId, new Set());
    }
    this.listeners.get(debateId)!.add(callback);

    // Send buffered events
    const buffered = this.eventBuffer.get(debateId) || [];
    for (const event of buffered) {
      callback(event);
    }

    return () => {
      this.listeners.get(debateId)?.delete(callback);
    };
  }

  emit(debateId: string, type: string, data: object) {
    const event = { type, timestamp: new Date(), data: { ...data, debateId } };

    // Buffer event
    if (!this.eventBuffer.has(debateId)) {
      this.eventBuffer.set(debateId, []);
    }
    this.eventBuffer.get(debateId)!.push(event);

    // Notify listeners
    const listeners = this.listeners.get(debateId);
    if (listeners) {
      for (const callback of listeners) {
        callback(event);
      }
    }
  }
}

// Singleton pattern
const globalForEvents = globalThis as unknown as {
  debateEventEmitter: DebateEventEmitter | undefined;
};

export const debateEventEmitter =
  globalForEvents.debateEventEmitter ?? new DebateEventEmitter();
```

## 7.3 The Debate Loop

```typescript
// app/api/debate/start/route.ts

async function runDebate(
  debateId: string,
  task: string,
  agents: DebateAgent[],
  moderator: ModeratorAgent
) {
  debateStateManager.start(debateId);
  debateEventEmitter.emit(debateId, "debate_started", { task });

  let round = 1;
  const maxRounds = moderator.maxRounds;
  let shouldContinue = true;

  while (shouldContinue && round <= maxRounds) {
    debateEventEmitter.emit(debateId, "round_started", { round });

    const roundArguments: DebateArgument[] = [];
    const previousArguments = debateStateManager.getAllArguments(debateId);

    // SEQUENTIAL: Each agent sees previous responses
    for (const agent of agents) {
      debateStateManager.setSpeakingAgent(debateId, agent.id);

      // Agent generates argument with context of all previous
      const result = await agent.generateArgument({
        debateId,
        task,
        round,
        previousArguments: [...previousArguments, ...roundArguments],
      });

      roundArguments.push(result.argument);
      debateStateManager.addArgument(debateId, result.argument);

      debateEventEmitter.emit(debateId, "agent_argument", {
        round,
        agentId: agent.id,
        argument: result.argument,
      });
    }

    // Moderator evaluates
    const decision = await moderator.evaluateRound({
      task,
      round,
      arguments: [...previousArguments, ...roundArguments],
    });

    if (decision === "conclude") {
      shouldContinue = false;
    } else {
      round++;
    }
  }

  // Generate summary
  const summary = await moderator.generateSummary({
    task,
    arguments: debateStateManager.getAllArguments(debateId),
  });

  debateStateManager.complete(debateId, summary);
  debateEventEmitter.emit(debateId, "debate_complete", { summary });
}
```

---

# 8. LLM INTEGRATION

## 8.1 LLM Client Interface

```typescript
// lib/llm/types.ts

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
    tools?: ToolDefinition[];
  }): Promise<{
    content: string;
    toolCalls?: ToolCall[];
  }>;
}
```

## 8.2 Ollama Provider

```typescript
// lib/llm/providers/ollama.ts

export class OllamaClient implements LLMClient {
  private endpoint: string;
  private model: string;

  constructor(endpoint: string = "http://localhost:11434", model: string = "llama3:8b") {
    this.endpoint = endpoint;
    this.model = model;
  }

  async chat(messages: LLMMessage[], options?: ChatOptions) {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2000,
        },
      }),
    });

    const data = await response.json();
    return { content: data.message.content };
  }
}
```

## 8.3 LLM Configuration

```json
// config/llm.json
{
  "providers": {
    "ollama": {
      "endpoint": "http://localhost:11434",
      "defaultModel": "llama3:8b",
      "enabled": true
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "defaultModel": "gpt-4-turbo",
      "enabled": false
    },
    "claude": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "defaultModel": "claude-sonnet-4-20250514",
      "enabled": false
    }
  },
  "defaults": {
    "provider": "ollama",
    "temperature": 0.3,
    "maxTokens": 5000
  }
}
```

---

# 9. STATE MANAGEMENT

## 9.1 Debate Context

```typescript
// contexts/DebateContext.tsx

interface DebateContextType {
  debateId: string | null;
  task: string;
  status: DebateStatus;
  currentRound: number;
  speakingAgent: string | undefined;
  thinkingAgent: string | undefined;
  currentTool: CurrentTool | undefined;
  rounds: DebateRound[];
  summary: DebateSummary | undefined;
  // Setters
  setTask: (task: string) => void;
  setStatus: (status: DebateStatus) => void;
  // ... more setters
}

const DebateContext = createContext<DebateContextType | null>(null);

export function DebateProvider({ children }: { children: React.ReactNode }) {
  const [debateId, setDebateId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState<string>();
  const [thinkingAgent, setThinkingAgent] = useState<string>();
  const [currentTool, setCurrentTool] = useState<CurrentTool>();
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [summary, setSummary] = useState<DebateSummary>();

  const value = useMemo(() => ({
    debateId, task, status, currentRound, speakingAgent,
    thinkingAgent, currentTool, rounds, summary,
    setDebateId, setTask, setStatus, setCurrentRound,
    setSpeakingAgent, setThinkingAgent, setCurrentTool,
    setRounds, setSummary,
  }), [debateId, task, status, currentRound, speakingAgent,
      thinkingAgent, currentTool, rounds, summary]);

  return (
    <DebateContext.Provider value={value}>
      {children}
    </DebateContext.Provider>
  );
}

export function useDebateContext() {
  const context = useContext(DebateContext);
  if (!context) throw new Error("useDebateContext must be used within DebateProvider");
  return context;
}
```

## 9.2 Debate Stream Hook

```typescript
// hooks/useDebateStream.ts

export function useDebateStream() {
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [speakingAgent, setSpeakingAgent] = useState<string>();
  const [summary, setSummary] = useState<DebateSummary>();
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((debateId: string) => {
    const es = new EventSource(`/api/debate/${debateId}/events`);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "debate_started":
          setStatus("debating");
          break;
        case "agent_argument":
          setRounds(prev => {
            // Update rounds with new argument
            const newRounds = [...prev];
            const roundIndex = data.data.round - 1;
            if (!newRounds[roundIndex]) {
              newRounds[roundIndex] = { number: data.data.round, arguments: [] };
            }
            newRounds[roundIndex].arguments.push(data.data.argument);
            return newRounds;
          });
          setSpeakingAgent(data.data.agentId);
          break;
        case "debate_complete":
          setStatus("complete");
          setSummary(data.data.summary);
          break;
      }
    };

    eventSourceRef.current = es;
  }, []);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
  }, []);

  return { status, rounds, speakingAgent, summary, connect, disconnect };
}
```

---

# 10. API ROUTES

## 10.1 Start Debate

```typescript
// app/api/debate/start/route.ts

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { task, selectedAgents } = await request.json();

  if (!task) {
    return NextResponse.json({ error: "Task required" }, { status: 400 });
  }

  const config = await loadAgentsConfig();
  const activeConfigs = selectedAgents
    ? config.agents.filter(a => selectedAgents.includes(a.id))
    : config.agents;

  if (activeConfigs.length < 2) {
    return NextResponse.json({ error: "Need 2+ agents" }, { status: 400 });
  }

  const debateId = `debate-${Date.now()}`;

  debateStateManager.create({ id: debateId, task, activeAgents: activeConfigs.map(a => a.id) });

  // Return immediately, run debate in background
  const response = NextResponse.json({
    debateId,
    status: "starting",
    agents: activeConfigs.map(a => ({ id: a.id, name: a.name, color: a.color })),
  });

  // Background execution
  runDebate(debateId, task, createDebateAgents(activeConfigs), new ModeratorAgent(config.moderator))
    .catch(err => debateStateManager.setError(debateId, err.message));

  return response;
}
```

## 10.2 SSE Events Endpoint

```typescript
// app/api/debate/[debateId]/events/route.ts

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = debateEventEmitter.subscribe(debateId, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      // Cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

---

# 11. CONFIGURATION FILES

## 11.1 Agent Configuration

```json
// config/agents.json
{
  "agents": [
    {
      "id": "dr-house",
      "name": "Dr House",
      "color": "#ff4444",
      "role": "Skeptical Medical Expert",
      "systemPrompt": "You are Dr. Gregory House, a brilliant but cynical diagnostician. Be direct, sarcastic, and always question assumptions. Focus on logic over emotion.",
      "tools": ["web_search", "calculator"]
    },
    {
      "id": "politician",
      "name": "Politician",
      "color": "#00ddaa",
      "role": "Diplomatic Negotiator",
      "systemPrompt": "You are a seasoned politician. Consider multiple perspectives, seek compromise, and frame arguments in terms of public good.",
      "tools": ["web_search"]
    },
    {
      "id": "scientist",
      "name": "Scientist",
      "color": "#ffaa00",
      "role": "Evidence-Based Researcher",
      "systemPrompt": "You are a research scientist. Base arguments on data and evidence. Acknowledge uncertainty and cite sources when possible.",
      "tools": ["web_search", "calculator"]
    }
  ],
  "moderator": {
    "maxRounds": 4,
    "systemPrompt": "You are the debate moderator. Evaluate arguments fairly, identify areas of agreement and disagreement, and determine when consensus has been reached."
  }
}
```

## 11.2 Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
};
```

---

# 12. CSS AND ANIMATIONS

## 12.1 Global CSS Variables

```css
/* app/globals.css */

:root {
  --background: #ffffff;
  --foreground: #171717;
  --accent-primary: #0ea5e9;
  --scene-bg: #e8f4fc;
}

.dark {
  --background: #030818;
  --foreground: #ededed;
  --accent-primary: #22d3ee;
  --scene-bg: #030014;
}
```

## 12.2 Key Animations

```css
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px currentColor, 0 0 10px currentColor;
  }
  50% {
    box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(10px);
  }
  50% { transform: scale(1.05); }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
.animate-float { animation: float 6s ease-in-out infinite; }
.animate-bounce-in { animation: bounceIn 0.4s ease-out forwards; }
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
```

---

# 13. AUDIO SYSTEM

## 13.1 Audio Manager

```typescript
// hooks/useDebateAudio.ts

class DebateAudioManager {
  private ctx: AudioContext | null = null;

  async init(): Promise<boolean> {
    try {
      this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return true;
    } catch {
      return false;
    }
  }

  playTone(frequency: number, duration: number = 0.2, volume: number = 0.1) {
    if (!this.ctx || this.ctx.state !== "running") return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.1);
  }

  playAgentSound(color: string) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const freq = 200 + ((r + g + b) / 765) * 300;

    this.playTone(freq, 0.3, 0.15);
  }
}
```

---

# 14. STEP-BY-STEP RECREATION

## Phase 1: Project Setup

```bash
# 1. Create Next.js project
npx create-next-app@latest debate-arena --typescript --tailwind --app

# 2. Install dependencies
cd debate-arena
npm install three @react-three/fiber @react-three/drei gsap lucide-react

# 3. Create folder structure
mkdir -p public/models
mkdir -p config
mkdir -p lib/{agents,llm,events,state,storage}
mkdir -p components/{visualization-3d,arena,ui}
mkdir -p hooks contexts
```

## Phase 2: Get the 3D Face Model

1. Download an OBJ face model (search "head bust obj free")
2. Place it at `public/models/face2.obj`
3. Test it loads correctly

## Phase 3: Create Core Files

1. Create `lib/agents/types.ts` - Type definitions
2. Create `lib/state/debate-state.ts` - State manager
3. Create `lib/events/emitter.ts` - Event system
4. Create `config/agents.json` - Agent configs
5. Create `config/llm.json` - LLM settings

## Phase 4: Build the Particle System

1. Create `components/visualization-3d/DebateScene.tsx`
2. Add the shaders (Section 4.3, 4.4)
3. Add helper functions (Section 4.5, 4.6, 4.7, 4.8)
4. Add MainSpeakingFace component (Section 4.10)
5. Add WaitingAgentFace component (Section 4.11)
6. Add Scene wrapper component

## Phase 5: Build the Debate System

1. Create `lib/agents/debate-agent.ts`
2. Create `lib/agents/moderator-agent.ts`
3. Create `app/api/debate/start/route.ts`
4. Create `app/api/debate/[debateId]/events/route.ts`
5. Create `hooks/useDebateStream.ts`

## Phase 6: Build the UI

1. Create `contexts/DebateContext.tsx`
2. Create `components/arena/DebateArena.tsx`
3. Create `app/debate/page.tsx`
4. Add CSS animations to `globals.css`

## Phase 7: Add Visual Effects

1. Add ArenaFloor component
2. Add HolographicHUD component
3. Add OrbitalRings component
4. Add SpectatorOrbs component
5. Add CinematicCamera component

## Phase 8: Add Audio

1. Create `hooks/useDebateAudio.ts`
2. Add audio toggle to UI

## Phase 9: Testing

1. Start Ollama: `ollama serve`
2. Pull a model: `ollama pull llama3:8b`
3. Start dev server: `npm run dev`
4. Open http://localhost:3000/debate
5. Enter a topic and start debate

---

# 15. TROUBLESHOOTING

## Face Not Loading
- Check browser console for 404 on face2.obj
- Verify OBJ file is valid (open in Blender)
- Check file is in `/public/models/` folder

## Particles Not Visible
- Check WebGL support in browser
- Verify shader compilation (check console)
- Adjust particle size uniform (try `uSize: 3.0`)

## Morph Not Working
- Ensure GSAP is imported correctly
- Check that `endArray` receives Float32Array
- Verify `position.needsUpdate = true` is called

## No Sound
- Audio requires user interaction first
- Check browser isn't muting the tab
- Look for `[Audio]` logs in console

## SSE Not Streaming
- Add `export const dynamic = "force-dynamic"` to routes
- Check for CORS issues
- Verify EventSource connects

---

# APPENDIX A: COMPLETE DEBATESCENE.TSX

[The complete 1500+ line file would be here - this is the most critical file]

Key sections to copy verbatim:
1. All shader code (lines 43-148)
2. loadFaceModel function (lines 212-253)
3. samplePointsOnSurface function (lines 168-192)
4. morphTo function (lines 822-854)
5. MainSpeakingFace component (lines 768-972)

---

# APPENDIX B: KEY TYPE DEFINITIONS

```typescript
// lib/agents/types.ts

export interface Agent {
  id: string;
  name: string;
  color: string;
}

export interface AgentConfig extends Agent {
  role: string;
  systemPrompt: string;
  tools: string[];
}

export interface DebateArgument {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  round: number;
  content: string;
  score?: number;
  confidence?: number;
  toolsUsed?: string[];
  timestamp: Date;
}

export interface DebateRound {
  number: number;
  arguments: DebateArgument[];
}

export interface DebateSummary {
  consensus: number;  // 0-100
  keyAgreements: string[];
  keyDisagreements: string[];
  recommendation: string;
  reasoning?: string;
}

export type DebateStatus =
  | "idle"
  | "loading"
  | "debating"
  | "paused"
  | "concluding"
  | "complete"
  | "error";

export interface DebateEvent {
  type: DebateEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export type DebateEventType =
  | "debate_started"
  | "round_started"
  | "agent_thinking"
  | "agent_argument"
  | "agent_tool_use"
  | "round_complete"
  | "debate_complete"
  | "debate_error";
```

---

**END OF DOCUMENT**

*This document contains all the information needed to recreate the Debate Arena application. The most critical section is Chapter 4 (Particle Face System) - copy those code blocks exactly as shown.*
