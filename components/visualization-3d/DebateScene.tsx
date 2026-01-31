"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { PersonaMesh } from "./PersonaMesh";
import { SpeechBubble } from "./SpeechBubble";

interface AgentInfo {
  id: string;
  name: string;
  color: string;
}

export interface DebateSceneProps {
  agents: AgentInfo[];
  speakingAgentId?: string | null;
  speechContent?: string;
  height?: number;
}

interface ScreenPosition {
  x: number;
  y: number;
  visible: boolean;
}

type ScreenPositions = Record<string, ScreenPosition>;

/**
 * Calculate positions for agents in a semi-circle
 */
function getAgentPositions(count: number): [number, number, number][] {
  if (count === 0) return [];

  const positions: [number, number, number][] = [];
  const radius = 12;
  const startAngle = -Math.PI / 3;
  const endAngle = Math.PI / 3;

  for (let i = 0; i < count; i++) {
    const angle = count === 1
      ? 0
      : startAngle + (endAngle - startAngle) * (i / (count - 1));
    positions.push([
      Math.sin(angle) * radius,
      0,
      -Math.cos(angle) * radius + 5,
    ]);
  }

  return positions;
}

function PositionTracker({
  agents,
  positions,
  onPositionsUpdate,
}: {
  agents: AgentInfo[];
  positions: [number, number, number][];
  onPositionsUpdate: (positions: ScreenPositions) => void;
}) {
  const { camera, size } = useThree();

  useFrame(() => {
    const screenPositions: ScreenPositions = {};

    agents.forEach((agent, i) => {
      const pos = positions[i];
      if (!pos) return;

      // Get head position (add 2.8 to Y for top of head)
      const headPos = new THREE.Vector3(pos[0], pos[1] + 2.8, pos[2]);
      headPos.project(camera);

      const x = (headPos.x * 0.5 + 0.5) * size.width;
      const y = (-headPos.y * 0.5 + 0.5) * size.height;

      screenPositions[agent.id] = {
        x,
        y,
        visible: headPos.z < 1,
      };
    });

    onPositionsUpdate(screenPositions);
  });

  return null;
}

function Scene({
  agents,
  speakingAgentId,
  positions,
  onPositionsUpdate,
}: {
  agents: AgentInfo[];
  speakingAgentId?: string | null;
  positions: [number, number, number][];
  onPositionsUpdate: (positions: ScreenPositions) => void;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 4, 25]} fov={45} />

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        autoRotate={!speakingAgentId}
        autoRotateSpeed={0.5}
        minDistance={10}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2}
      />

      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, 10, -10]} intensity={0.3} color="#00f3ff" />
      <pointLight position={[0, -10, 0]} intensity={0.2} color="#ff0055" />

      <fog attach="fog" args={["#050508", 15, 60]} />

      <PositionTracker
        agents={agents}
        positions={positions}
        onPositionsUpdate={onPositionsUpdate}
      />

      {agents.map((agent, i) => (
        <PersonaMesh
          key={agent.id}
          agentId={agent.id}
          color={agent.color}
          position={positions[i] || [0, 0, 0]}
          isSpeaking={speakingAgentId === agent.id}
        />
      ))}

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          intensity={1.2}
          radius={0.5}
        />
      </EffectComposer>
    </>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#333" wireframe />
    </mesh>
  );
}

function AgentLabel({
  agent,
  isSpeaking,
}: {
  agent: AgentInfo;
  isSpeaking: boolean;
}) {
  return (
    <div
      className="text-center transition-all duration-300"
      style={{
        opacity: isSpeaking ? 1 : 0.7,
        transform: isSpeaking ? "scale(1.1)" : "scale(1)",
      }}
    >
      <div
        className="text-xs font-bold uppercase tracking-widest"
        style={{
          fontFamily: "'Orbitron', monospace",
          background: `linear-gradient(90deg, #fff, ${agent.color})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: isSpeaking ? `0 0 10px ${agent.color}` : "none",
        }}
      >
        {agent.name}
      </div>
    </div>
  );
}

export function DebateScene({
  agents,
  speakingAgentId,
  speechContent,
  height = 400,
}: DebateSceneProps) {
  const [screenPositions, setScreenPositions] = useState<ScreenPositions>({});
  const positionsRef = useRef<ScreenPositions>({});

  const positions = getAgentPositions(agents.length);

  const handlePositionsUpdate = useCallback((positions: ScreenPositions) => {
    positionsRef.current = positions;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setScreenPositions({ ...positionsRef.current });
    }, 16);
    return () => clearInterval(interval);
  }, []);

  const speakingAgent = agents.find((a) => a.id === speakingAgentId);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ height, background: "#050508" }}
    >
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Scene
            agents={agents}
            speakingAgentId={speakingAgentId}
            positions={positions}
            onPositionsUpdate={handlePositionsUpdate}
          />
        </Suspense>
      </Canvas>

      {/* Speech bubble overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {speakingAgent && speechContent && screenPositions[speakingAgent.id] && (
          <SpeechBubble
            agentName={speakingAgent.name}
            content={speechContent}
            color={speakingAgent.color}
            position={screenPositions[speakingAgent.id]}
          />
        )}
      </div>

      {/* Agent labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around px-8 pb-4 pointer-events-none">
        {agents.map((agent) => (
          <AgentLabel
            key={agent.id}
            agent={agent}
            isSpeaking={speakingAgentId === agent.id}
          />
        ))}
      </div>
    </div>
  );
}
