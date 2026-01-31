"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { PersonaMesh } from "./PersonaMesh";
import { SpeechBubble } from "./SpeechBubble";
import { StarField, DustParticles } from "./StarField";
import type { DebateArgument } from "@/lib/agents/types";

interface Agent {
  id: string;
  name: string;
  color: string;
}

interface DebateSceneProps {
  agents: Agent[];
  speakingAgentId?: string;
  currentArgument?: DebateArgument;
  arguments?: DebateArgument[];
}

// Calculate positions for agents in a semi-circle
function getAgentPosition(index: number, total: number): [number, number, number] {
  if (total === 1) return [0, 0, 0];

  // Arrange in a semi-circle facing the camera
  const angleSpread = Math.PI * 0.6; // 108 degrees spread
  const startAngle = -angleSpread / 2;
  const angle = startAngle + (index / (total - 1)) * angleSpread;

  const radius = total > 3 ? 1.5 : 1.2;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius * 0.3;
  const y = 0;

  return [x, y, z];
}

function Scene({ agents, speakingAgentId, currentArgument }: DebateSceneProps) {
  const agentPositions = useMemo(
    () => agents.map((_, i) => getAgentPosition(i, agents.length)),
    [agents.length]
  );

  // Get the speaking agent's info
  const speakingAgent = agents.find((a) => a.id === speakingAgentId);
  const speakingIndex = agents.findIndex((a) => a.id === speakingAgentId);
  const speakingPosition = speakingIndex >= 0 ? agentPositions[speakingIndex] : null;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 5]} intensity={0.3} color="#00ffcc" />
      <pointLight position={[-3, 2, -2]} intensity={0.2} color="#0088ff" />
      <pointLight position={[3, 2, -2]} intensity={0.2} color="#00ff88" />

      {/* Star field background */}
      <StarField count={400} radius={15} color="#4488aa" />
      <DustParticles count={80} color="#00ffcc" />

      {/* Persona meshes for each agent */}
      {agents.map((agent, index) => (
        <PersonaMesh
          key={agent.id}
          position={agentPositions[index]}
          color={agent.color}
          isSpeaking={agent.id === speakingAgentId}
          speakingIntensity={agent.id === speakingAgentId ? 0.8 : 0}
        />
      ))}

      {/* Speech bubble for current speaker */}
      {speakingAgent && speakingPosition && currentArgument && (
        <SpeechBubble
          position={[speakingPosition[0], speakingPosition[1] + 0.7, speakingPosition[2]]}
          text={currentArgument.content.substring(0, 150) + (currentArgument.content.length > 150 ? "..." : "")}
          agentName={speakingAgent.name}
          color={speakingAgent.color}
        />
      )}

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={6}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.65}
        autoRotate={!speakingAgentId}
        autoRotateSpeed={0.3}
      />

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

export function DebateScene(props: DebateSceneProps) {
  return (
    <div className="w-full h-full bg-[#0a0f14] rounded-xl overflow-hidden">
      <Canvas
        camera={{ position: [0, 0.3, 2.5], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0a0f14"]} />
        <fog attach="fog" args={["#0a0f14", 5, 15]} />
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      </Canvas>

      {/* Agent labels overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-4">
        {props.agents.map((agent) => (
          <div
            key={agent.id}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              agent.id === props.speakingAgentId
                ? "ring-2 ring-offset-2 ring-offset-gray-900"
                : "opacity-60"
            }`}
            style={{
              backgroundColor: `${agent.color}20`,
              color: agent.color,
              borderColor: agent.color,
              boxShadow: agent.id === props.speakingAgentId ? `0 0 20px ${agent.color}40` : "none",
            }}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 ${
                agent.id === props.speakingAgentId ? "animate-pulse" : ""
              }`}
              style={{ backgroundColor: agent.color }}
            />
            {agent.name}
          </div>
        ))}
      </div>
    </div>
  );
}
