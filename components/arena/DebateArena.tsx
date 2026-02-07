"use client";

import { useCallback, useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DocumentInput } from "./DocumentInput";
import { TaskInput } from "./TaskInput";
import { DebateTimeline } from "@/components/visualization-2d/DebateTimeline";
import { ConsensusVisualization } from "@/components/visualization-2d/ConsensusVisualization";
import { ModeratorPanel } from "@/components/moderator/ModeratorPanel";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { useDebateStream } from "@/hooks/useDebateStream";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { useDebateContext } from "@/contexts/DebateContext";
import { useDebateAudio } from "@/hooks/useDebateAudio";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { X, MessageSquare, ChevronRight, ChevronLeft, Pause, Play, Sparkles, Share2, Users, Volume2, VolumeX } from "lucide-react";

// Dynamically import 3D scene and ParticleBackground to avoid SSR issues
const DebateScene = dynamic(
  () => import("@/components/visualization-3d/DebateScene").then((m) => m.DebateScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[var(--scene-bg)] animate-pulse" /> }
);

const ParticleBackground = dynamic(
  () => import("@/components/shared/ParticleBackground").then((m) => m.ParticleBackground),
  { ssr: false }
);

// Unified Setup Dialog Component
function SetupDialog({
  isOpen,
  onClose,
  task,
  onTaskChange,
  onDocumentLoaded,
  agents,
  selectedAgents,
  onAgentToggle,
  onStart,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: string;
  onTaskChange: (task: string) => void;
  onDocumentLoaded: (content: string, name: string) => void;
  agents: Array<{ id: string; name: string; color: string }>;
  selectedAgents: string[];
  onAgentToggle: (agentId: string) => void;
  onStart: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="setup-dialog-overlay" onClick={onClose}>
      <div className="setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="setup-dialog-header">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent-primary-muted)]">
              <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Start a Debate</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--glass-border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="setup-dialog-content space-y-5">
          {/* Document input */}
          <div>
            <label className="text-sm font-medium text-[var(--foreground-muted)] mb-2 block">
              Document (Optional)
            </label>
            <DocumentInput onDocumentLoaded={onDocumentLoaded} />
          </div>

          {/* Task input */}
          <TaskInput value={task} onChange={onTaskChange} />

          {/* Agent selection */}
          <div>
            <label className="text-sm font-medium text-[var(--foreground-muted)] mb-2 block">
              Select Agents
            </label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => onAgentToggle(agent.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    selectedAgents.includes(agent.id) || selectedAgents.length === 0
                      ? "border-transparent text-white"
                      : "border-[var(--glass-border)] text-[var(--foreground-muted)] bg-[var(--surface)]"
                  }`}
                  style={{
                    backgroundColor:
                      selectedAgents.includes(agent.id) || selectedAgents.length === 0
                        ? agent.color
                        : undefined,
                  }}
                >
                  {agent.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-2">
              {selectedAgents.length === 0
                ? "All agents will participate"
                : `${selectedAgents.length} agent(s) selected`}
            </p>
          </div>

          {/* Start button */}
          <button
            onClick={onStart}
            disabled={!task.trim()}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
          >
            Start Debate
          </button>
        </div>
      </div>
    </div>
  );
}

export function DebateArena() {
  // Use context for persistent state
  const ctx = useDebateContext();
  const { config, loading: configLoading } = useAgentConfig();
  const debateStream = useDebateStream();
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Get the speaking agent's color for audio
  const speakingAgentColor = useMemo(() => {
    if (!debateStream.speakingAgent || !config) return undefined;
    const agent = config.agents.find(a => a.id === debateStream.speakingAgent);
    return agent?.color;
  }, [debateStream.speakingAgent, config]);

  // Audio system
  const { initialize: initAudio, isInitialized: audioReady } = useDebateAudio(
    {
      status: debateStream.status,
      speakingAgentId: debateStream.speakingAgent,
      agentColor: speakingAgentColor,
      argumentCount: debateStream.rounds.reduce((sum, r) => sum + r.arguments.length, 0),
    },
    { enabled: audioEnabled, volume: 0.5 }
  );

  // Handle audio toggle
  const handleAudioToggle = useCallback(async () => {
    if (!audioEnabled) {
      const success = await initAudio();
      if (success) {
        setAudioEnabled(true);
      }
    } else {
      setAudioEnabled(false);
    }
  }, [audioEnabled, initAudio]);

  // Sync debate stream state to context when it changes
  useEffect(() => {
    if (debateStream.status !== "idle") {
      ctx.setStatus(debateStream.status);
      ctx.setRounds(debateStream.rounds);
      ctx.setCurrentRound(debateStream.currentRound);
      ctx.setSpeakingAgent(debateStream.speakingAgent);
      ctx.setThinkingAgent(debateStream.thinkingAgent);
      ctx.setCurrentTool(debateStream.currentTool);
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
    debateStream.currentTool,
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
  const currentTool = ctx.debateId ? ctx.currentTool : debateStream.currentTool;
  const moderatorSteps = ctx.debateId ? ctx.moderatorSteps : debateStream.moderatorSteps;
  const summary = ctx.debateId ? ctx.summary : debateStream.summary;
  const error = ctx.debateId ? ctx.error : debateStream.error;
  const allArguments = rounds.flatMap((r) => r.arguments);

  // Local state for moderator panel visibility
  const [showModeratorPanel, setShowModeratorPanel] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  // Fetch viewer count when debate is active
  useEffect(() => {
    if (!ctx.debateId || status === "idle" || status === "complete") return;

    const fetchViewerCount = async () => {
      try {
        const response = await fetch(`/api/debate/${ctx.debateId}/collab`);
        if (response.ok) {
          const data = await response.json();
          setViewerCount(data.viewerCount);
        }
      } catch {
        // Silently fail
      }
    };

    fetchViewerCount();
    const interval = setInterval(fetchViewerCount, 10000);
    return () => clearInterval(interval);
  }, [ctx.debateId, status]);

  // Handle sharing
  const handleShare = useCallback(async () => {
    if (!ctx.debateId) return;

    try {
      const response = await fetch(`/api/debate/${ctx.debateId}/collab`);
      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}${data.shareUrl}`;
        await navigator.clipboard.writeText(shareUrl);
        alert("Share link copied to clipboard!");
      }
    } catch {
      alert("Failed to copy share link");
    }
  }, [ctx.debateId]);

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

  const handlePause = useCallback(async () => {
    const success = await debateStream.pause();
    if (success) {
      ctx.setStatus("paused");
    }
  }, [debateStream, ctx]);

  const handleResume = useCallback(async () => {
    const success = await debateStream.resume();
    if (success) {
      ctx.setStatus("debating");
    }
  }, [debateStream, ctx]);

  if (configLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--background)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const allConfigAgents = config?.agents.map((a) => ({ id: a.id, name: a.name, color: a.color })) || [];

  // 3D View - Full immersive experience
  if (ctx.view === "3d") {
    return (
      <div className="fixed inset-0">
        {/* 3D Scene - Full screen */}
        <DebateScene
          agents={agents}
          speakingAgentId={speakingAgent}
          currentArgument={currentArgument}
          arguments={allArguments}
          status={status}
          thinkingAgentId={thinkingAgent}
          currentTool={currentTool}
          summary={summary}
          task={ctx.task}
          onReset={handleReset}
        />

        {/* Floating Navigation */}
        <FloatingNav
          view={ctx.view}
          onViewChange={ctx.setView}
          showViewToggle={true}
          position="top-left"
        />

        {/* Top bar with status - hide when complete (summary overlay is shown) */}
        {status !== "complete" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-full glass">
                <span className="font-semibold text-[var(--foreground)]">Debate Arena</span>
              </div>
              {status !== "idle" && (
                <div className="px-3 py-1.5 rounded-full bg-[var(--accent-primary-muted)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-sm">
                  Round {currentRound}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Control buttons - hide when complete */}
        <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 safe-area-right ${status === "complete" ? "hidden" : ""}`}>
          {/* Viewer count */}
          {status !== "idle" && viewerCount > 0 && (
            <div className="px-3 py-2 rounded-lg glass text-[var(--accent-primary)] text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{viewerCount}</span>
            </div>
          )}
          {/* Audio toggle */}
          {status !== "idle" && (
            <button
              onClick={handleAudioToggle}
              className={`px-3 py-2 rounded-lg glass text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${
                audioEnabled && audioReady ? "text-cyan-400" : "text-[var(--foreground)]"
              }`}
              title={audioEnabled ? "Mute audio" : "Enable audio (click to activate)"}
            >
              {audioEnabled && audioReady ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          {/* Share button */}
          {status !== "idle" && status !== "complete" && (
            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-lg glass text-[var(--foreground)] text-sm hover:bg-white/10 transition-colors flex items-center gap-2"
              title="Share live debate"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          {(status === "debating" || status === "paused") && (
            <>
              {status === "debating" ? (
                <button
                  onClick={handlePause}
                  className="px-3 py-2 rounded-lg glass text-amber-500 text-sm hover:bg-amber-500/10 transition-colors flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" />
                  <span className="hidden sm:inline">Pause</span>
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  className="px-3 py-2 rounded-lg glass text-green-500 text-sm hover:bg-green-500/10 transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span className="hidden sm:inline">Resume</span>
                </button>
              )}
            </>
          )}
          {status !== "idle" && status !== "complete" && (
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-lg glass text-red-500 text-sm hover:bg-red-500/10 transition-colors"
            >
              End Debate
            </button>
          )}
        </div>

        {/* Unified Setup Dialog */}
        <SetupDialog
          isOpen={ctx.showSetup && status === "idle"}
          onClose={() => ctx.setShowSetup(false)}
          task={ctx.task}
          onTaskChange={ctx.setTask}
          onDocumentLoaded={handleDocumentLoaded}
          agents={allConfigAgents}
          selectedAgents={ctx.selectedAgents}
          onAgentToggle={handleAgentToggle}
          onStart={handleStart}
        />

        {/* Floating setup button when panel is closed */}
        {!ctx.showSetup && status === "idle" && (
          <button
            onClick={() => ctx.setShowSetup(true)}
            className="absolute bottom-6 right-6 z-20 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg shadow-cyan-500/25 safe-area-bottom safe-area-right"
          >
            Setup Debate
          </button>
        )}

        {/* Moderator Panel - Collapsible side overlay during debate (hide when complete) */}
        {status !== "idle" && status !== "complete" && (
          <>
            {/* Collapsed state - small toggle button */}
            {!showModeratorPanel && (
              <button
                onClick={() => setShowModeratorPanel(true)}
                className="absolute top-20 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg glass transition-all hover:scale-105 safe-area-right"
              >
                <MessageSquare className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-[var(--accent-primary)] text-sm font-medium">Moderator</span>
                <ChevronLeft className="w-4 h-4 text-[var(--accent-primary)]" />
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
                className="absolute -left-10 top-2 z-30 flex items-center justify-center w-8 h-8 rounded-l-lg glass transition-all hover:scale-105"
              >
                <ChevronRight className="w-4 h-4 text-[var(--accent-primary)]" />
              </button>

              <div className="h-full overflow-auto rounded-l-xl glass-strong mr-0 safe-area-right">
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
          <div className="absolute bottom-6 left-6 right-6 z-20 p-4 bg-red-900/80 backdrop-blur-md border border-red-700 rounded-xl safe-area-bottom">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // 2D View - With particle background
  return (
    <div className="min-h-screen relative">
      {/* Particle Background (subtle) */}
      <ParticleBackground particleCount={100} subtle={true} intensity={0.5} />

      {/* Floating Navigation */}
      <FloatingNav
        view={ctx.view}
        onViewChange={ctx.setView}
        showViewToggle={true}
        position="top-left"
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Debate Arena</h1>
          {status !== "idle" && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-[var(--accent-primary-muted)] text-[var(--accent-primary)] text-sm">
                Round {currentRound}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main visualization area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl p-6">
              <ConsensusVisualization arguments={allArguments} summary={summary} task={ctx.task} />
            </div>

            {/* Timeline */}
            {status !== "idle" && (
              <div className="glass rounded-2xl p-6">
                <h2 className="font-semibold text-[var(--foreground)] mb-4">Debate Timeline</h2>
                <DebateTimeline rounds={rounds} currentRound={currentRound} />
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Controls */}
            {status === "idle" ? (
              <div className="glass rounded-2xl p-6 space-y-6">
                <h2 className="font-semibold text-[var(--foreground)]">Setup</h2>

                {/* Document input */}
                <div>
                  <h3 className="text-sm font-medium text-[var(--foreground-muted)] mb-2">
                    Document (Optional)
                  </h3>
                  <DocumentInput onDocumentLoaded={handleDocumentLoaded} />
                </div>

                {/* Task input */}
                <TaskInput value={ctx.task} onChange={ctx.setTask} />

                {/* Agent selection */}
                <div>
                  <h3 className="text-sm font-medium text-[var(--foreground-muted)] mb-2">Select Agents</h3>
                  <div className="flex flex-wrap gap-2">
                    {allConfigAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleAgentToggle(agent.id)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                          ctx.selectedAgents.includes(agent.id) || ctx.selectedAgents.length === 0
                            ? "border-transparent text-white"
                            : "border-[var(--glass-border)] text-[var(--foreground-muted)] bg-[var(--surface)]"
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
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    {ctx.selectedAgents.length === 0
                      ? "All agents will participate"
                      : `${ctx.selectedAgents.length} agent(s) selected`}
                  </p>
                </div>

                {/* Start button */}
                <button
                  onClick={handleStart}
                  disabled={!ctx.task.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Start Debate
                </button>
              </div>
            ) : (
              <>
                {/* Status and controls during debate */}
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    {(status === "debating" || status === "paused") && (
                      <>
                        {status === "debating" ? (
                          <button
                            onClick={handlePause}
                            className="flex-1 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-500 text-sm hover:bg-amber-500/30 transition-colors flex items-center justify-center gap-2"
                          >
                            <Pause className="w-4 h-4" />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={handleResume}
                            className="flex-1 px-3 py-2 rounded-lg bg-green-500/20 text-green-500 text-sm hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Resume
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={handleReset}
                      className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 text-red-500 text-sm hover:bg-red-500/30 transition-colors"
                    >
                      End Debate
                    </button>
                  </div>
                </div>

                {/* Moderator panel */}
                <div className="glass rounded-2xl overflow-hidden">
                  <ModeratorPanel
                    steps={moderatorSteps}
                    currentRound={currentRound}
                    isActive={status === "debating" || status === "concluding"}
                    summary={summary}
                  />
                </div>
              </>
            )}

            {/* Error display */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
