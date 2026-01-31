"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
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
import { useDebateContext } from "@/contexts/DebateContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { X, MessageSquare, ChevronRight, ChevronLeft } from "lucide-react";

// Dynamically import 3D scene to avoid SSR issues
const DebateScene = dynamic(
  () => import("@/components/visualization-3d/DebateScene").then((m) => m.DebateScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[#030818] animate-pulse" /> }
);

export function DebateArena() {
  // Use context for persistent state
  const ctx = useDebateContext();
  const { config, loading: configLoading } = useAgentConfig();
  const debateStream = useDebateStream();

  // Sync debate stream state to context when it changes
  useEffect(() => {
    if (debateStream.status !== "idle") {
      ctx.setStatus(debateStream.status);
      ctx.setRounds(debateStream.rounds);
      ctx.setCurrentRound(debateStream.currentRound);
      ctx.setSpeakingAgent(debateStream.speakingAgent);
      ctx.setThinkingAgent(debateStream.thinkingAgent);
      ctx.setModeratorSteps(debateStream.moderatorSteps);
      ctx.setSummary(debateStream.summary);
      ctx.setError(debateStream.error);
    }
  }, [
    debateStream.status,
    debateStream.rounds,
    debateStream.currentRound,
    debateStream.speakingAgent,
    debateStream.thinkingAgent,
    debateStream.moderatorSteps,
    debateStream.summary,
    debateStream.error,
  ]);

  // Reconnect to existing debate on mount
  useEffect(() => {
    if (ctx.debateId && ctx.status !== "idle" && ctx.status !== "complete" && ctx.status !== "error") {
      debateStream.connect(ctx.debateId);
    }
  }, []);

  // Use context state if we have an active debate, otherwise use stream state
  const status = ctx.debateId ? ctx.status : debateStream.status;
  const rounds = ctx.debateId ? ctx.rounds : debateStream.rounds;
  const currentRound = ctx.debateId ? ctx.currentRound : debateStream.currentRound;
  const speakingAgent = ctx.debateId ? ctx.speakingAgent : debateStream.speakingAgent;
  const thinkingAgent = ctx.debateId ? ctx.thinkingAgent : debateStream.thinkingAgent;
  const moderatorSteps = ctx.debateId ? ctx.moderatorSteps : debateStream.moderatorSteps;
  const summary = ctx.debateId ? ctx.summary : debateStream.summary;
  const error = ctx.debateId ? ctx.error : debateStream.error;
  const allArguments = rounds.flatMap((r) => r.arguments);

  // Local state for moderator panel visibility
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);

  // Agent info for visualization
  const agents = useMemo(() => {
    if (!config) return [];
    const agentIds = ctx.selectedAgents.length > 0 ? ctx.selectedAgents : config.agents.map((a) => a.id);
    return config.agents
      .filter((a) => agentIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, color: a.color }));
  }, [config, ctx.selectedAgents]);

  // Get current speaking agent's argument
  const currentArgument = useMemo(() => {
    if (!speakingAgent) return undefined;
    return allArguments.filter((a) => a.agentId === speakingAgent).pop();
  }, [speakingAgent, allArguments]);

  const handleDocumentLoaded = useCallback((content: string, name: string) => {
    ctx.setDocument({ content, name });
  }, [ctx]);

  const handleAgentToggle = useCallback((agentId: string) => {
    ctx.setSelectedAgents(
      ctx.selectedAgents.includes(agentId)
        ? ctx.selectedAgents.filter((id) => id !== agentId)
        : [...ctx.selectedAgents, agentId]
    );
  }, [ctx]);

  const handleStart = useCallback(async () => {
    if (!ctx.task.trim()) {
      alert("Please enter a debate topic");
      return;
    }

    try {
      const response = await fetch("/api/debate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: ctx.task,
          documentContent: ctx.document?.content,
          documentName: ctx.document?.name,
          selectedAgents: ctx.selectedAgents.length > 0 ? ctx.selectedAgents : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start debate");
      }

      const data = await response.json();
      ctx.setDebateId(data.debateId);
      ctx.setShowSetup(false);
      ctx.setStatus("loading");
      debateStream.connect(data.debateId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start debate");
    }
  }, [ctx, debateStream]);

  const handleReset = useCallback(() => {
    debateStream.disconnect();
    ctx.resetDebate();
  }, [debateStream, ctx]);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Full-screen 3D mode
  if (ctx.view === "3d") {
    return (
      <div className="fixed inset-0 z-50">
        {/* 3D Scene - Full screen */}
        <DebateScene
          agents={agents}
          speakingAgentId={speakingAgent}
          currentArgument={currentArgument}
          arguments={allArguments}
          status={status}
          thinkingAgentId={thinkingAgent}
        />

        {/* Top bar with controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
              <span className="text-white font-semibold">Debate Arena</span>
            </div>
            {status !== "idle" && (
              <div className="px-3 py-1.5 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-500/30 text-cyan-400 text-sm">
                Round {currentRound}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ViewToggle view={ctx.view} onChange={ctx.setView} />
            {status !== "idle" && (
              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-lg bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
              >
                End Debate
              </button>
            )}
          </div>
        </div>

        {/* Setup Panel - Floating overlay */}
        {ctx.showSetup && status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg mx-4">
              <Card className="bg-gray-900/90 border-gray-700 backdrop-blur-xl shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-gray-700">
                  <h2 className="font-semibold text-white text-lg">Start a Debate</h2>
                  <button
                    onClick={() => ctx.setShowSetup(false)}
                    className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  {/* Document input */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Document (Optional)
                    </label>
                    <DocumentInput onDocumentLoaded={handleDocumentLoaded} />
                  </div>

                  {/* Task input */}
                  <TaskInput value={ctx.task} onChange={ctx.setTask} />

                  {/* Agent selection */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Select Agents
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {config?.agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => handleAgentToggle(agent.id)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                            ctx.selectedAgents.includes(agent.id) || ctx.selectedAgents.length === 0
                              ? "border-transparent text-white"
                              : "border-gray-600 text-gray-400 bg-gray-800"
                          }`}
                          style={{
                            backgroundColor:
                              ctx.selectedAgents.includes(agent.id) || ctx.selectedAgents.length === 0
                                ? agent.color
                                : undefined,
                          }}
                        >
                          {agent.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {ctx.selectedAgents.length === 0
                        ? "All agents will participate"
                        : `${ctx.selectedAgents.length} agent(s) selected`}
                    </p>
                  </div>

                  {/* Start button */}
                  <button
                    onClick={handleStart}
                    disabled={!ctx.task.trim()}
                    className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
                  >
                    Start Debate
                  </button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Floating setup button when panel is closed */}
        {!ctx.showSetup && status === "idle" && (
          <button
            onClick={() => ctx.setShowSetup(true)}
            className="absolute bottom-6 right-6 z-20 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg shadow-cyan-500/25"
          >
            Setup Debate
          </button>
        )}

        {/* Moderator Panel - Collapsible side overlay during debate */}
        {status !== "idle" && (
          <>
            {/* Collapsed state - small toggle button */}
            {!showModeratorPanel && (
              <button
                onClick={() => setShowModeratorPanel(true)}
                className="absolute top-20 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, rgba(0,200,255,0.15) 0%, rgba(0,100,200,0.1) 100%)",
                  border: "1px solid rgba(0,200,255,0.3)",
                  boxShadow: "0 0 20px rgba(0,200,255,0.2)",
                }}
              >
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-300 text-sm font-medium">Moderator</span>
                <ChevronLeft className="w-4 h-4 text-cyan-400" />
              </button>
            )}

            {/* Expanded state - full panel */}
            <div
              className={`absolute top-20 right-0 bottom-20 w-80 z-20 transition-transform duration-300 ease-out ${
                showModeratorPanel ? "translate-x-0" : "translate-x-full"
              }`}
            >
              {/* Close button */}
              <button
                onClick={() => setShowModeratorPanel(false)}
                className="absolute -left-10 top-2 z-30 flex items-center justify-center w-8 h-8 rounded-l-lg transition-all hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, rgba(0,200,255,0.2) 0%, rgba(0,100,200,0.15) 100%)",
                  border: "1px solid rgba(0,200,255,0.3)",
                  borderRight: "none",
                }}
              >
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              </button>

              <div className="h-full overflow-auto rounded-l-xl bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 border-r-0 shadow-2xl mr-0">
                <ModeratorPanel
                  steps={moderatorSteps}
                  currentRound={currentRound}
                  isActive={status === "debating" || status === "concluding"}
                  summary={summary}
                />
              </div>
            </div>
          </>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute bottom-6 left-6 right-6 z-20 p-4 bg-red-900/80 backdrop-blur-md border border-red-700 rounded-xl">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // 2D View - Traditional layout
  return (
    <div className="space-y-6">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Debate Arena</h1>
        <ViewToggle view={ctx.view} onChange={ctx.setView} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main visualization area */}
        <div className="lg:col-span-2 space-y-6">
          <ConsensusVisualization arguments={allArguments} summary={summary} task={ctx.task} />

          {/* Timeline */}
          {status !== "idle" && (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">Debate Timeline</h2>
              </CardHeader>
              <CardContent>
                <DebateTimeline rounds={rounds} currentRound={currentRound} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Controls */}
          {status === "idle" ? (
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 dark:text-white">Setup</h2>
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
                <TaskInput value={ctx.task} onChange={ctx.setTask} />

                {/* Agent selection */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Agents</h3>
                  <div className="flex flex-wrap gap-2">
                    {config?.agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleAgentToggle(agent.id)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                          ctx.selectedAgents.includes(agent.id) || ctx.selectedAgents.length === 0
                            ? "border-transparent text-white"
                            : "border-gray-300 text-gray-600 bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:bg-gray-800"
                        }`}
                        style={{
                          backgroundColor:
                            ctx.selectedAgents.includes(agent.id) || ctx.selectedAgents.length === 0
                              ? agent.color
                              : undefined,
                        }}
                      >
                        {agent.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {ctx.selectedAgents.length === 0
                      ? "All agents will participate"
                      : `${ctx.selectedAgents.length} agent(s) selected`}
                  </p>
                </div>

                {/* Start button */}
                <DebateControls status={status} onStart={handleStart} onReset={handleReset} disabled={!ctx.task.trim()} />
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Status and controls during debate */}
              <Card>
                <CardContent className="py-4">
                  <DebateControls status={status} onStart={handleStart} onReset={handleReset} />
                </CardContent>
              </Card>

              {/* Moderator panel */}
              <ModeratorPanel
                steps={moderatorSteps}
                currentRound={currentRound}
                isActive={status === "debating" || status === "concluding"}
                summary={summary}
              />
            </>
          )}

          {/* Error display */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
