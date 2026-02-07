"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  GitBranch,
} from "lucide-react";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { SavedDebate } from "@/lib/storage/debate-history";
import type { DebateArgument, DebateSummary } from "@/lib/agents/types";

const DebateScene = dynamic(
  () => import("@/components/visualization-3d/DebateScene").then((m) => m.DebateScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[var(--scene-bg)] animate-pulse" /> }
);

interface ReplayState {
  isPlaying: boolean;
  currentStep: number;
  speed: number;
  currentArgument?: DebateArgument;
  speakingAgentId?: string;
  visibleArguments: DebateArgument[];
  showSummary: boolean;
}

export default function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [debate, setDebate] = useState<SavedDebate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [replayState, setReplayState] = useState<ReplayState>({
    isPlaying: false,
    currentStep: -1,
    speed: 1,
    visibleArguments: [],
    showSummary: false,
  });

  // Get all arguments in order
  const allArguments = debate?.rounds.flatMap((r) => r.arguments) || [];
  const totalSteps = allArguments.length + 1; // +1 for summary

  useEffect(() => {
    fetchDebate();
  }, [id]);

  async function fetchDebate() {
    try {
      const response = await fetch(`/api/debates/${id}`);
      if (!response.ok) throw new Error("Debate not found");
      const data = await response.json();
      setDebate(data.debate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load debate");
    } finally {
      setLoading(false);
    }
  }

  // Auto-advance when playing
  useEffect(() => {
    if (!replayState.isPlaying || !debate) return;

    const interval = setInterval(() => {
      setReplayState((prev) => {
        const nextStep = prev.currentStep + 1;
        if (nextStep >= totalSteps) {
          return { ...prev, isPlaying: false, showSummary: true };
        }

        const arg = allArguments[nextStep];
        return {
          ...prev,
          currentStep: nextStep,
          currentArgument: arg,
          speakingAgentId: arg?.agentId,
          visibleArguments: allArguments.slice(0, nextStep + 1),
          showSummary: nextStep >= allArguments.length,
        };
      });
    }, 4000 / replayState.speed);

    return () => clearInterval(interval);
  }, [replayState.isPlaying, replayState.speed, debate, allArguments, totalSteps]);

  const togglePlay = useCallback(() => {
    setReplayState((prev) => {
      // If at end, restart
      if (prev.currentStep >= totalSteps - 1 && !prev.isPlaying) {
        return {
          ...prev,
          isPlaying: true,
          currentStep: 0,
          currentArgument: allArguments[0],
          speakingAgentId: allArguments[0]?.agentId,
          visibleArguments: [allArguments[0]],
          showSummary: false,
        };
      }
      return { ...prev, isPlaying: !prev.isPlaying };
    });
  }, [allArguments, totalSteps]);

  const goToStep = useCallback(
    (step: number) => {
      const clampedStep = Math.max(-1, Math.min(step, totalSteps - 1));
      const arg = allArguments[clampedStep];
      setReplayState((prev) => ({
        ...prev,
        isPlaying: false,
        currentStep: clampedStep,
        currentArgument: arg,
        speakingAgentId: arg?.agentId,
        visibleArguments: clampedStep >= 0 ? allArguments.slice(0, clampedStep + 1) : [],
        showSummary: clampedStep >= allArguments.length,
      }));
    },
    [allArguments, totalSteps]
  );

  const changeSpeed = useCallback(() => {
    setReplayState((prev) => ({
      ...prev,
      speed: prev.speed === 0.5 ? 1 : prev.speed === 1 ? 2 : 0.5,
    }));
  }, []);

  const handleBranch = useCallback(async () => {
    if (!debate || replayState.currentStep < 0) return;

    const currentArg = allArguments[replayState.currentStep];
    if (!currentArg) return;

    const newTopic = prompt(
      "Enter a topic for the branched debate (or leave empty to keep the original):",
      `What if: ${debate.topic}`
    );

    if (newTopic === null) return; // User cancelled

    try {
      const response = await fetch(`/api/debates/${debate.id}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: currentArg.round,
          argumentIndex: replayState.currentStep,
          newTopic: newTopic || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Navigate to start a new debate from this branch
        router.push(`/debate?branch=${data.branch.id}`);
      } else {
        alert("Failed to create branch");
      }
    } catch {
      alert("Failed to create branch");
    }
  }, [debate, replayState.currentStep, allArguments, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--background)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !debate) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            {error || "Debate not found"}
          </h1>
          <button
            onClick={() => router.push("/history")}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  const progress = ((replayState.currentStep + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0">
      <DebateScene
        agents={debate.agents}
        speakingAgentId={replayState.speakingAgentId}
        currentArgument={replayState.currentArgument}
        arguments={replayState.visibleArguments}
        status={replayState.showSummary ? "complete" : replayState.currentStep >= 0 ? "debating" : "idle"}
        summary={replayState.showSummary ? debate.summary : undefined}
        task={debate.topic}
        onReset={() => router.push("/history")}
      />

      <FloatingNav position="top-left" />

      {/* Back button and title */}
      <div className="absolute top-4 left-20 z-20 flex items-center gap-3">
        <button
          onClick={() => router.push("/history")}
          className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
        </button>
        <div className="px-4 py-2 rounded-full glass">
          <span className="text-[var(--foreground)] text-sm font-medium">
            Replay: {debate.topic.slice(0, 40)}{debate.topic.length > 40 ? "..." : ""}
          </span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
        <div
          className="flex flex-col items-center gap-4 px-6 py-4 rounded-2xl"
          style={{
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Progress bar */}
          <div className="w-80 flex items-center gap-3">
            <span className="text-xs text-white/60 w-12 text-right">
              {replayState.currentStep + 1}/{totalSteps}
            </span>
            <div
              className="flex-1 h-1.5 rounded-full bg-white/10 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                goToStep(Math.floor(percent * totalSteps) - 1);
              }}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => goToStep(0)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Start"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={() => goToStep(replayState.currentStep - 1)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Previous"
            >
              <Rewind className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg shadow-cyan-500/25"
            >
              {replayState.isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => goToStep(replayState.currentStep + 1)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Next"
            >
              <FastForward className="w-5 h-5" />
            </button>

            <button
              onClick={() => goToStep(totalSteps - 1)}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="End"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-white/20 mx-2" />

            <button
              onClick={changeSpeed}
              className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-medium"
              title="Playback speed"
            >
              {replayState.speed}x
            </button>

            <div className="w-px h-6 bg-white/20 mx-2" />

            {/* Branch button */}
            <button
              onClick={handleBranch}
              disabled={replayState.currentStep < 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Branch from this point"
            >
              <GitBranch className="w-4 h-4" />
              <span className="text-sm font-medium">Branch</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
