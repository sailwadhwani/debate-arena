"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Save, Shield, Briefcase, Package, Cpu, User, Bot } from "lucide-react";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AgentConfig, AvatarType, AgentRole, AgentBias } from "@/lib/agents/types";

const AVATAR_ICONS: Record<AvatarType, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  briefcase: Briefcase,
  package: Package,
  cpu: Cpu,
  user: User,
  bot: Bot,
};

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
];

const ROLES: AgentRole[] = ["compliance", "business", "product", "technical", "custom"];
const BIASES: AgentBias[] = ["cautious", "optimistic", "balanced", "pragmatic", "neutral"];
const AVATARS: AvatarType[] = ["shield", "briefcase", "package", "cpu", "user", "bot"];
const TOOLS = ["web_search", "calculator", "query_document"];

export default function AgentsPage() {
  const { config, loading, error, updateAgent, addAgent, deleteAgent } = useAgentConfig();
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

  const handleEdit = (agent: AgentConfig) => {
    setEditingAgent({ ...agent });
    setIsNew(false);
  };

  const handleNew = () => {
    setEditingAgent({
      id: `agent-${Date.now()}`,
      name: "New Agent",
      role: "custom",
      avatar: "user",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      systemPrompt: "You are a helpful AI assistant...",
      bias: "balanced",
      tools: ["query_document"],
    });
    setIsNew(true);
  };

  const handleSave = async () => {
    if (!editingAgent) return;

    try {
      if (isNew) {
        await addAgent(editingAgent);
      } else {
        await updateAgent(editingAgent.id, editingAgent);
      }
      setEditingAgent(null);
      setIsNew(false);
    } catch (e) {
      console.error("Failed to save agent:", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;

    try {
      await deleteAgent(id);
    } catch (e) {
      console.error("Failed to delete agent:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/debate">
            <Button variant="outline">Back to Debate</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/debate"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </Link>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Agent Configuration
              </h1>
            </div>
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add Agent
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {config?.agents.map((agent) => {
            const Icon = AVATAR_ICONS[agent.avatar] || User;

            return (
              <Card key={agent.id} className="overflow-hidden">
                <div
                  className="h-2"
                  style={{ backgroundColor: agent.color }}
                />
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        <div style={{ color: agent.color }}>
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-gray-500 capitalize">
                          {agent.role} - {agent.bias}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                    {agent.systemPrompt}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {agent.tools.map((tool) => (
                      <span
                        key={tool}
                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(agent)}
                    className="w-full"
                  >
                    Edit
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Edit Modal */}
        {editingAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <h2 className="text-lg font-semibold">
                  {isNew ? "New Agent" : "Edit Agent"}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingAgent.name}
                    onChange={(e) =>
                      setEditingAgent({ ...editingAgent, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                  />
                </div>

                {/* Role & Bias */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <select
                      value={editingAgent.role}
                      onChange={(e) =>
                        setEditingAgent({
                          ...editingAgent,
                          role: e.target.value as AgentRole,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bias
                    </label>
                    <select
                      value={editingAgent.bias}
                      onChange={(e) =>
                        setEditingAgent({
                          ...editingAgent,
                          bias: e.target.value as AgentBias,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    >
                      {BIASES.map((bias) => (
                        <option key={bias} value={bias}>
                          {bias}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Avatar & Color */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Avatar
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVATARS.map((avatar) => {
                        const Icon = AVATAR_ICONS[avatar];
                        return (
                          <button
                            key={avatar}
                            onClick={() =>
                              setEditingAgent({ ...editingAgent, avatar })
                            }
                            className={`p-2 rounded-lg border-2 transition-colors ${
                              editingAgent.avatar === avatar
                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            setEditingAgent({ ...editingAgent, color })
                          }
                          className={`w-8 h-8 rounded-lg transition-transform ${
                            editingAgent.color === color
                              ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    System Prompt
                  </label>
                  <textarea
                    value={editingAgent.systemPrompt}
                    onChange={(e) =>
                      setEditingAgent({
                        ...editingAgent,
                        systemPrompt: e.target.value,
                      })
                    }
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 resize-none"
                  />
                </div>

                {/* Tools */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tools
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOOLS.map((tool) => (
                      <button
                        key={tool}
                        onClick={() => {
                          const tools = editingAgent.tools.includes(tool)
                            ? editingAgent.tools.filter((t) => t !== tool)
                            : [...editingAgent.tools, tool];
                          setEditingAgent({ ...editingAgent, tools });
                        }}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          editingAgent.tools.includes(tool)
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingAgent(null);
                      setIsNew(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
