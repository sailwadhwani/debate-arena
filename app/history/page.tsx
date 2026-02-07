"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { History, Play, Trash2, ArrowLeft, MessageSquare, Users } from "lucide-react";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { DebateListItem } from "@/lib/storage/debate-history";

export default function HistoryPage() {
  const [debates, setDebates] = useState<DebateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchDebates();
  }, []);

  async function fetchDebates() {
    try {
      const response = await fetch("/api/debates");
      if (!response.ok) throw new Error("Failed to load debates");
      const data = await response.json();
      setDebates(data.debates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load debates");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this debate?")) return;

    try {
      const response = await fetch(`/api/debates/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete debate");
      setDebates(debates.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete debate");
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getConsensusColor(consensus?: number) {
    if (!consensus) return "text-gray-400";
    if (consensus >= 70) return "text-green-400";
    if (consensus >= 40) return "text-yellow-400";
    return "text-red-400";
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--background)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <FloatingNav position="top-left" />

      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-[var(--glass-border)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--foreground-muted)]" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent-primary-muted)]">
              <History className="w-6 h-6 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">Debate History</h1>
              <p className="text-sm text-[var(--foreground-muted)]">{debates.length} debates saved</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {debates.length === 0 && !error && (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-medium text-[var(--foreground)]">No debates yet</h2>
            <p className="text-[var(--foreground-muted)] mt-2">
              Start a debate to see it appear here
            </p>
            <button
              onClick={() => router.push("/debate")}
              className="mt-4 px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 transition-all"
            >
              Start a Debate
            </button>
          </div>
        )}

        <div className="space-y-4">
          {debates.map((debate) => (
            <div
              key={debate.id}
              className="glass rounded-2xl p-5 hover:border-[var(--accent-primary)]/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-[var(--foreground)] truncate">
                    {debate.topic}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-[var(--foreground-muted)]">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      {debate.agentNames.join(", ")}
                    </span>
                    <span>{debate.roundCount} rounds</span>
                    {debate.consensus !== undefined && (
                      <span className={getConsensusColor(debate.consensus)}>
                        {debate.consensus}% consensus
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--foreground-muted)] mt-2">
                    {formatDate(debate.completedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => router.push(`/history/${debate.id}`)}
                    className="p-2 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/30 transition-colors"
                    title="Replay debate"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(debate.id)}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Delete debate"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
