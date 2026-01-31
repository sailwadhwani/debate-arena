"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { DocumentInput } from "./DocumentInput";
import { TaskInput } from "./TaskInput";
import { ViewToggle } from "./ViewToggle";
import { DebateControls } from "./DebateControls";
import { DebateTimeline } from "@/components/visualization-2d/DebateTimeline";
import { ConsensusVisualization } from "@/components/visualization-2d/ConsensusVisualization";
import { ModeratorPanel } from "@/components/moderator/ModeratorPanel";
import { useDebateStream } from "@/hooks/useDebateStream";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AgentConfig } from "@/lib/agents/types";

// Dynamically import 3D scene to avoid SSR issues
const DebateScene = dynamic(
  () => import("@/components/visualization-3d/DebateScene").then((m) => m.DebateScene),
  { ssr: false, loading: () => <div className="h-[400px] bg-gray-900 rounded-xl animate-pulse" /> }
);

export function DebateArena() {
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [task, setTask] = useState("");
  const [document, setDocument] = useState<{ content: string; name: string } | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [debateId, setDebateId] = useState<string | null>(null);

  const { config, loading: configLoading } = useAgentConfig();
  const debateStream = useDebateStream();

  // Agent info for visualization
  const agents = useMemo(() => {
    if (!config) return [];
    const agentIds = selectedAgents.length > 0 ? selectedAgents : config.agents.map((a) => a.id);
    return config.agents
      .filter((a) => agentIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, color: a.color }));
  }, [config, selectedAgents]);

  // Get current speaking agent's speech content
  const speechContent = useMemo(() => {
    if (!debateStream.speakingAgent) return undefined;
    const latest = debateStream.arguments
      .filter((a) => a.agentId === debateStream.speakingAgent)
      .pop();
    return latest?.content;
  }, [debateStream.speakingAgent, debateStream.arguments]);

  const handleDocumentLoaded = useCallback((content: string, name: string) => {
    setDocument({ content, name });
  }, []);

  const handleAgentToggle = useCallback((agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  }, []);

  const handleStart = useCallback(async () => {
    if (!task.trim()) {
      alert("Please enter a debate task");
      return;
    }

    try {
      const response = await fetch("/api/debate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          documentContent: document?.content,
          documentName: document?.name,
          selectedAgents: selectedAgents.length > 0 ? selectedAgents : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start debate");
      }

      const data = await response.json();
      setDebateId(data.debateId);
      debateStream.connect(data.debateId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start debate");
    }
  }, [task, document, selectedAgents, debateStream]);

  const handleReset = useCallback(() => {
    debateStream.disconnect();
    setDebateId(null);
    setTask("");
    setDocument(null);
  }, [debateStream]);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Debate Arena
        </h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main visualization area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Visualization */}
          {view === "3d" ? (
            <DebateScene
              agents={agents}
              speakingAgentId={debateStream.speakingAgent}
              speechContent={speechContent}
              height={400}
            />
          ) : (
            <ConsensusVisualization
              arguments={debateStream.arguments}
              summary={debateStream.summary}
              task={task}
            />
          )}

          {/* Timeline */}
          {debateStream.status !== "idle" && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Debate Timeline
                </h2>
              </CardHeader>
              <CardContent>
                <DebateTimeline
                  rounds={debateStream.rounds}
                  currentRound={debateStream.currentRound}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Controls */}
          {debateStream.status === "idle" ? (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Setup
                </h2>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Document input */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Document (Optional)
                  </h3>
                  <DocumentInput onDocumentLoaded={handleDocumentLoaded} />
                </div>

                {/* Task input */}
                <TaskInput value={task} onChange={setTask} />

                {/* Agent selection */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Agents
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {config?.agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleAgentToggle(agent.id)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                          selectedAgents.includes(agent.id) ||
                          selectedAgents.length === 0
                            ? "border-transparent text-white"
                            : "border-gray-300 text-gray-600 bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:bg-gray-800"
                        }`}
                        style={{
                          backgroundColor:
                            selectedAgents.includes(agent.id) ||
                            selectedAgents.length === 0
                              ? agent.color
                              : undefined,
                        }}
                      >
                        {agent.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedAgents.length === 0
                      ? "All agents will participate"
                      : `${selectedAgents.length} agent(s) selected`}
                  </p>
                </div>

                {/* Start button */}
                <DebateControls
                  status={debateStream.status}
                  onStart={handleStart}
                  onReset={handleReset}
                  disabled={!task.trim()}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Status and controls during debate */}
              <Card>
                <CardContent className="py-4">
                  <DebateControls
                    status={debateStream.status}
                    onStart={handleStart}
                    onReset={handleReset}
                  />
                </CardContent>
              </Card>

              {/* Moderator panel */}
              <ModeratorPanel
                steps={debateStream.moderatorSteps}
                currentRound={debateStream.currentRound}
                isActive={debateStream.status === "debating" || debateStream.status === "concluding"}
                summary={debateStream.summary}
              />
            </>
          )}

          {/* Error display */}
          {debateStream.error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {debateStream.error}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
