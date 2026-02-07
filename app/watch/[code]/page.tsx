"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Users, ThumbsUp, ThumbsDown, Share2, ArrowLeft } from "lucide-react";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDebateStream } from "@/hooks/useDebateStream";
import type { DebateArgument, DebateSummary } from "@/lib/agents/types";

const DebateScene = dynamic(
  () => import("@/components/visualization-3d/DebateScene").then((m) => m.DebateScene),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[var(--scene-bg)] animate-pulse" /> }
);

interface CollabData {
  viewerCount: number;
  reactions: Record<string, { agree: number; disagree: number }>;
}

export default function WatchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [debateId, setDebateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerId] = useState(() => `viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [collabData, setCollabData] = useState<CollabData>({ viewerCount: 0, reactions: {} });
  const [agents, setAgents] = useState<{ id: string; name: string; color: string }[]>([]);
  const router = useRouter();
  const debateStream = useDebateStream();

  // Decode share code and connect
  useEffect(() => {
    async function connect() {
      try {
        // Decode the share code
        const decoded = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
        setDebateId(decoded);

        // Join as viewer
        const response = await fetch(`/api/debate/${decoded}/collab`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", viewerId }),
        });

        if (!response.ok) throw new Error("Debate not found or ended");

        const data = await response.json();
        setCollabData((prev) => ({ ...prev, viewerCount: data.viewerCount }));

        // Fetch initial collab data
        const collabResponse = await fetch(`/api/debate/${decoded}/collab`);
        if (collabResponse.ok) {
          const collabInfo = await collabResponse.json();
          setCollabData(collabInfo);
        }

        // Connect to SSE stream
        debateStream.connect(decoded);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join debate");
      }
    }

    connect();

    // Cleanup - leave when unmounting
    return () => {
      if (debateId) {
        fetch(`/api/debate/${debateId}/collab`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "leave", viewerId }),
        });
      }
    };
  }, [code, viewerId]);

  // Handle reactions
  async function handleReaction(argumentId: string, type: "agree" | "disagree") {
    if (!debateId) return;

    try {
      const response = await fetch(`/api/debate/${debateId}/collab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "react",
          argumentId,
          reactionType: type,
          viewerId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCollabData((prev) => ({
          ...prev,
          reactions: {
            ...prev.reactions,
            [argumentId]: data.reactions,
          },
        }));
      }
    } catch {
      // Silently fail
    }
  }

  // Copy share link
  function copyShareLink() {
    navigator.clipboard.writeText(window.location.href);
    alert("Link copied to clipboard!");
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[var(--foreground)] mb-4">{error}</h1>
          <button
            onClick={() => router.push("/debate")}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white"
          >
            Start Your Own Debate
          </button>
        </div>
      </div>
    );
  }

  const allArguments = debateStream.rounds.flatMap((r) => r.arguments);
  const currentArgument = debateStream.speakingAgent
    ? allArguments.filter((a) => a.agentId === debateStream.speakingAgent).pop()
    : undefined;

  // Get agents from the stream or use defaults
  const displayAgents = agents.length > 0 ? agents : allArguments.reduce((acc, arg) => {
    if (!acc.find((a) => a.id === arg.agentId)) {
      acc.push({ id: arg.agentId, name: arg.agentName, color: "#00aaff" });
    }
    return acc;
  }, [] as { id: string; name: string; color: string }[]);

  return (
    <div className="fixed inset-0">
      <DebateScene
        agents={displayAgents}
        speakingAgentId={debateStream.speakingAgent}
        currentArgument={currentArgument}
        arguments={allArguments}
        status={debateStream.status}
        thinkingAgentId={debateStream.thinkingAgent}
        summary={debateStream.summary}
      />

      <FloatingNav position="top-left" />

      {/* Viewer count and share button */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
          <Users className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-[var(--foreground)] text-sm font-medium">
            {collabData.viewerCount} watching
          </span>
        </div>
        <button
          onClick={copyShareLink}
          className="p-2 rounded-full glass hover:bg-white/10 transition-colors"
          title="Copy share link"
        >
          <Share2 className="w-5 h-5 text-[var(--foreground)]" />
        </button>
      </div>

      {/* Back button */}
      <div className="absolute top-4 left-20 z-20">
        <button
          onClick={() => router.push("/debate")}
          className="p-2 rounded-lg glass hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--foreground)]" />
        </button>
      </div>

      {/* Reaction panel for current argument */}
      {currentArgument && debateStream.status === "debating" && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div
            className="flex items-center gap-4 px-6 py-3 rounded-full"
            style={{
              background: "rgba(0, 0, 0, 0.7)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <span className="text-white/60 text-sm">React to this point:</span>
            <button
              onClick={() => handleReaction(currentArgument.id, "agree")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
            >
              <ThumbsUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                {collabData.reactions[currentArgument.id]?.agree || 0}
              </span>
            </button>
            <button
              onClick={() => handleReaction(currentArgument.id, "disagree")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              <ThumbsDown className="w-4 h-4" />
              <span className="text-sm font-medium">
                {collabData.reactions[currentArgument.id]?.disagree || 0}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {debateStream.status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <span className="text-white/80">Joining debate...</span>
          </div>
        </div>
      )}
    </div>
  );
}
