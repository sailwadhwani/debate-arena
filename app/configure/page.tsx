"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Trash2,
  Shield,
  Briefcase,
  Package,
  Cpu,
  User,
  Bot,
  Settings,
  ChevronDown,
  ChevronRight,
  Cloud,
  Server,
  FileText,
  Sliders,
  Users,
  GripVertical,
} from "lucide-react";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import { FloatingNav } from "@/components/nav/FloatingNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { AgentConfig, AvatarType, AgentRole, AgentBias, ModeratorConfig } from "@/lib/agents/types";

// Dynamically import ParticleBackground
const ParticleBackground = dynamic(
  () => import("@/components/shared/ParticleBackground").then((m) => m.ParticleBackground),
  { ssr: false }
);

// ============================================================================
// TYPES
// ============================================================================

interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  defaultModel: string;
  enabled: boolean;
}

interface LLMConfig {
  providers: {
    claude: ProviderConfig;
    openai: ProviderConfig;
    gemini: ProviderConfig;
    ollama: ProviderConfig;
  };
  defaults: {
    provider: string;
    temperature: number;
    maxTokens: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROVIDER_INFO = {
  claude: {
    name: "Claude (Anthropic)",
    envVar: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    hasEndpoint: false,
    color: "#D97706",
    type: "cloud" as const,
  },
  openai: {
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    models: ["gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    hasEndpoint: false,
    color: "#10B981",
    type: "cloud" as const,
  },
  gemini: {
    name: "Google Gemini",
    envVar: "GOOGLE_AI_API_KEY",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    hasEndpoint: false,
    color: "#3B82F6",
    type: "cloud" as const,
  },
  ollama: {
    name: "Ollama (Local)",
    envVar: null,
    models: ["qwen2.5:3b", "llama3.2", "llama3.1", "mistral", "codellama", "mixtral"],
    hasEndpoint: true,
    color: "#8B5CF6",
    type: "local" as const,
  },
};

const AVATAR_ICONS: Record<AvatarType, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  briefcase: Briefcase,
  package: Package,
  cpu: Cpu,
  user: User,
  bot: Bot,
};

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

const ROLES: AgentRole[] = ["compliance", "business", "product", "technical", "custom"];
const BIASES: AgentBias[] = ["cautious", "optimistic", "balanced", "pragmatic", "neutral"];
const AVATARS: AvatarType[] = ["shield", "briefcase", "package", "cpu", "user", "bot"];
const TOOLS = ["web_search", "calculator", "query_document"];

// ============================================================================
// BUTTON COMPONENT
// ============================================================================

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
  size?: "sm" | "md";
  className?: string;
}) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-xl transition-all";
  const sizeClasses = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2";
  const variantClasses = variant === "primary"
    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50"
    : "border border-[var(--glass-border)] text-[var(--foreground)] hover:bg-[var(--glass-bg)] disabled:opacity-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// CARD COMPONENTS
// ============================================================================

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 border-b border-[var(--glass-border)] ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// TABS COMPONENTS
// ============================================================================

function Tabs({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div data-value={value} data-onchange={onChange}>
      {children}
    </div>
  );
}

function TabsList({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex gap-1 p-1 glass rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  active,
  onClick,
  children,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-[var(--accent-primary-muted)] text-[var(--accent-primary)]"
          : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--glass-border)]"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// LLM PROVIDERS TAB COMPONENT
// ============================================================================

function LLMProvidersTab() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, "testing" | "success" | "error" | null>>({});
  const [expandedGroups, setExpandedGroups] = useState({ cloud: true, local: true });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/settings/llm");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (provider: string) => {
    setTestResults((prev) => ({ ...prev, [provider]: "testing" }));
    try {
      const res = await fetch("/api/settings/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [provider]: data.success ? "success" : "error" }));
    } catch {
      setTestResults((prev) => ({ ...prev, [provider]: "error" }));
    }
  };

  const updateProvider = (
    provider: keyof LLMConfig["providers"],
    field: keyof ProviderConfig,
    value: string | boolean
  ) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        [provider]: {
          ...config.providers[provider],
          [field]: value,
        },
      },
    });
  };

  const toggleGroup = (group: "cloud" | "local") => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const cloudProviders = (Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).filter(
    (k) => PROVIDER_INFO[k].type === "cloud"
  );
  const localProviders = (Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).filter(
    (k) => PROVIDER_INFO[k].type === "local"
  );

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Settings saved successfully!
        </div>
      )}

      {/* Default Provider */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Default Provider</h2>
          <p className="text-sm text-[var(--foreground-muted)]">Select the default LLM provider for debates</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map((key) => {
              const info = PROVIDER_INFO[key];
              const isSelected = config?.defaults.provider === key;
              return (
                <button
                  key={key}
                  onClick={() =>
                    setConfig((c) =>
                      c ? { ...c, defaults: { ...c.defaults, provider: key } } : c
                    )
                  }
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary-muted)]"
                      : "border-[var(--glass-border)] hover:border-[var(--glass-border-strong)] bg-[var(--surface)]"
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full mx-auto mb-2"
                    style={{ backgroundColor: info.color }}
                  />
                  <span className="text-sm font-medium text-[var(--foreground)]">{info.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                Temperature
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config?.defaults.temperature || 0.3}
                onChange={(e) =>
                  setConfig((c) =>
                    c
                      ? { ...c, defaults: { ...c.defaults, temperature: parseFloat(e.target.value) } }
                      : c
                  )
                }
                className="w-full accent-[var(--accent-primary)]"
              />
              <div className="flex justify-between text-xs text-[var(--foreground-muted)] mt-1">
                <span>Precise (0)</span>
                <span className="text-[var(--accent-primary)]">{config?.defaults.temperature}</span>
                <span>Creative (1)</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={config?.defaults.maxTokens || 4096}
                onChange={(e) =>
                  setConfig((c) =>
                    c
                      ? { ...c, defaults: { ...c.defaults, maxTokens: parseInt(e.target.value) || 4096 } }
                      : c
                  )
                }
                className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl focus:border-[var(--accent-primary)] focus:outline-none text-[var(--foreground)]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Providers */}
      <div className="space-y-4">
        <button
          onClick={() => toggleGroup("cloud")}
          className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)] w-full"
        >
          {expandedGroups.cloud ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          <Cloud className="w-5 h-5 text-[var(--accent-primary)]" />
          Cloud Providers
        </button>

        {expandedGroups.cloud && (
          <div className="space-y-4 pl-7">
            {cloudProviders.map((key) => (
              <ProviderCard
                key={key}
                providerKey={key}
                info={PROVIDER_INFO[key]}
                config={config?.providers[key]}
                showKeys={showKeys}
                setShowKeys={setShowKeys}
                testResults={testResults}
                testConnection={testConnection}
                updateProvider={updateProvider}
              />
            ))}
          </div>
        )}
      </div>

      {/* Local Providers */}
      <div className="space-y-4">
        <button
          onClick={() => toggleGroup("local")}
          className="flex items-center gap-2 text-lg font-semibold text-[var(--foreground)] w-full"
        >
          {expandedGroups.local ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          <Server className="w-5 h-5 text-purple-400" />
          Local Providers
        </button>

        {expandedGroups.local && (
          <div className="space-y-4 pl-7">
            {localProviders.map((key) => (
              <ProviderCard
                key={key}
                providerKey={key}
                info={PROVIDER_INFO[key]}
                config={config?.providers[key]}
                showKeys={showKeys}
                setShowKeys={setShowKeys}
                testResults={testResults}
                testConnection={testConnection}
                updateProvider={updateProvider}
              />
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// Provider Card Component
function ProviderCard({
  providerKey,
  info,
  config,
  showKeys,
  setShowKeys,
  testResults,
  testConnection,
  updateProvider,
}: {
  providerKey: keyof typeof PROVIDER_INFO;
  info: typeof PROVIDER_INFO[keyof typeof PROVIDER_INFO];
  config?: ProviderConfig;
  showKeys: Record<string, boolean>;
  setShowKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  testResults: Record<string, "testing" | "success" | "error" | null>;
  testConnection: (provider: string) => Promise<void>;
  updateProvider: (provider: keyof LLMConfig["providers"], field: keyof ProviderConfig, value: string | boolean) => void;
}) {
  const testResult = testResults[providerKey];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: info.color }} />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{info.name}</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-[var(--foreground-muted)]">Enabled</span>
            <div
              className={`w-10 h-6 rounded-full transition-colors relative ${
                config?.enabled ? "bg-[var(--accent-primary)]" : "bg-[var(--glass-border)]"
              }`}
              onClick={() => updateProvider(providerKey, "enabled", !config?.enabled)}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  config?.enabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </div>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key */}
        {info.envVar && (
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
              API Key
              <span className="text-[var(--foreground-muted)] font-normal ml-2">(or set {info.envVar} env var)</span>
            </label>
            <div className="relative">
              <input
                type={showKeys[providerKey] ? "text" : "password"}
                value={config?.apiKey || ""}
                onChange={(e) => updateProvider(providerKey, "apiKey", e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl focus:border-[var(--accent-primary)] focus:outline-none font-mono text-sm text-[var(--foreground)]"
              />
              <button
                type="button"
                onClick={() => setShowKeys((s) => ({ ...s, [providerKey]: !s[providerKey] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                {showKeys[providerKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Endpoint (Ollama) */}
        {info.hasEndpoint && (
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">Endpoint URL</label>
            <input
              type="text"
              value={config?.endpoint || "http://localhost:11434"}
              onChange={(e) => updateProvider(providerKey, "endpoint", e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl focus:border-[var(--accent-primary)] focus:outline-none font-mono text-sm text-[var(--foreground)]"
            />
          </div>
        )}

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">Default Model</label>
          <select
            value={config?.defaultModel || info.models[0]}
            onChange={(e) => updateProvider(providerKey, "defaultModel", e.target.value)}
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--glass-border)] rounded-xl focus:border-[var(--accent-primary)] focus:outline-none text-[var(--foreground)]"
          >
            {info.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testConnection(providerKey)}
            disabled={testResult === "testing"}
          >
            {testResult === "testing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Test Connection
          </Button>
          {testResult === "success" && (
            <span className="flex items-center gap-1 text-sm text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              Connected
            </span>
          )}
          {testResult === "error" && (
            <span className="flex items-center gap-1 text-sm text-red-400">
              <XCircle className="w-4 h-4" />
              Connection failed
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// AGENTS TAB COMPONENT
// ============================================================================

function AgentsTab() {
  const { config, loading, error, updateAgent, addAgent, deleteAgent, reorderAgents, refetch } = useAgentConfig();
  const [editingAgent, setEditingAgent] = useState<AgentConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draggedAgent, setDraggedAgent] = useState<string | null>(null);
  const [dragOverAgent, setDragOverAgent] = useState<string | null>(null);

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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    setDraggedAgent(agentId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", agentId);
  };

  const handleDragOver = (e: React.DragEvent, agentId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (agentId !== draggedAgent) {
      setDragOverAgent(agentId);
    }
  };

  const handleDragLeave = () => {
    setDragOverAgent(null);
  };

  const handleDrop = async (e: React.DragEvent, targetAgentId: string) => {
    e.preventDefault();
    setDragOverAgent(null);

    if (!draggedAgent || !config || draggedAgent === targetAgentId) {
      setDraggedAgent(null);
      return;
    }

    // Get current order
    const agentIds = config.agents.map(a => a.id);
    const draggedIndex = agentIds.indexOf(draggedAgent);
    const targetIndex = agentIds.indexOf(targetAgentId);

    // Reorder
    agentIds.splice(draggedIndex, 1);
    agentIds.splice(targetIndex, 0, draggedAgent);

    try {
      await reorderAgents(agentIds);
    } catch (e) {
      console.error("Failed to reorder agents:", e);
    }

    setDraggedAgent(null);
  };

  const handleDragEnd = () => {
    setDraggedAgent(null);
    setDragOverAgent(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Agent Button */}
      <div className="flex justify-end">
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Agent Grid */}
      <p className="text-sm text-[var(--foreground-muted)] -mt-2 mb-4">
        Drag cards to reorder speaking order
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {config?.agents.map((agent, index) => {
          const Icon = AVATAR_ICONS[agent.avatar] || User;
          const isDragging = draggedAgent === agent.id;
          const isDragOver = dragOverAgent === agent.id;

          return (
            <div
              key={agent.id}
              draggable
              onDragStart={(e) => handleDragStart(e, agent.id)}
              onDragOver={(e) => handleDragOver(e, agent.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, agent.id)}
              onDragEnd={handleDragEnd}
              className={`cursor-grab active:cursor-grabbing transition-all ${
                isDragging ? "opacity-50 scale-95" : ""
              } ${isDragOver ? "ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--background)] scale-[1.02]" : ""}`}
            >
              <Card className="relative">
                {/* Order badge */}
                <div
                  className="absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg z-10"
                  style={{ backgroundColor: agent.color }}
                >
                  {index + 1}
                </div>
                <div className="h-2 rounded-t-xl" style={{ backgroundColor: agent.color }} />
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {/* Drag handle */}
                    <div className="text-[var(--foreground-muted)] opacity-50 hover:opacity-100 transition-opacity">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${agent.color}20` }}>
                      <div style={{ color: agent.color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">{agent.name}</h3>
                      <p className="text-xs text-[var(--foreground-muted)] capitalize">
                        {agent.role} - {agent.bias}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(agent.id)}
                    className="p-1 text-[var(--foreground-muted)] hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-[var(--foreground-muted)] line-clamp-3 mb-4">{agent.systemPrompt}</p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {agent.tools.map((tool) => (
                    <span key={tool} className="px-2 py-0.5 text-xs bg-[var(--surface)] rounded text-[var(--foreground-muted)]">
                      {tool}
                    </span>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={() => handleEdit(agent)} className="w-full">
                  Edit
                </Button>
              </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">{isNew ? "New Agent" : "Edit Agent"}</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Name</label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent({ ...editingAgent, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)]"
                />
              </div>

              {/* Role & Bias */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Role</label>
                  <select
                    value={editingAgent.role}
                    onChange={(e) => setEditingAgent({ ...editingAgent, role: e.target.value as AgentRole })}
                    className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)]"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Bias</label>
                  <select
                    value={editingAgent.bias}
                    onChange={(e) => setEditingAgent({ ...editingAgent, bias: e.target.value as AgentBias })}
                    className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)]"
                  >
                    {BIASES.map((bias) => (
                      <option key={bias} value={bias}>{bias}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Avatar & Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Avatar</label>
                  <div className="flex flex-wrap gap-2">
                    {AVATARS.map((avatar) => {
                      const Icon = AVATAR_ICONS[avatar];
                      return (
                        <button
                          key={avatar}
                          onClick={() => setEditingAgent({ ...editingAgent, avatar })}
                          className={`p-2 rounded-xl border-2 transition-colors ${
                            editingAgent.avatar === avatar
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary-muted)]"
                              : "border-[var(--glass-border)] hover:border-[var(--glass-border-strong)]"
                          }`}
                        >
                          <Icon className="w-5 h-5 text-[var(--foreground-muted)]" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditingAgent({ ...editingAgent, color })}
                        className={`w-8 h-8 rounded-xl transition-transform ${
                          editingAgent.color === color ? "ring-2 ring-offset-2 ring-offset-[var(--background)] ring-[var(--foreground-muted)] scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">System Prompt</label>
                <textarea
                  value={editingAgent.systemPrompt}
                  onChange={(e) => setEditingAgent({ ...editingAgent, systemPrompt: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)] resize-none"
                />
              </div>

              {/* Tools */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Tools</label>
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
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary-muted)] text-[var(--accent-primary)]"
                          : "border-[var(--glass-border)] text-[var(--foreground-muted)] hover:border-[var(--glass-border-strong)]"
                      }`}
                    >
                      {tool}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--glass-border)]">
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
    </div>
  );
}

// ============================================================================
// MODERATOR TAB COMPONENT
// ============================================================================

function ModeratorTab() {
  const { config, loading, refetch } = useAgentConfig();
  const [moderator, setModerator] = useState<ModeratorConfig | null>(null);
  const [moderatorDirty, setModeratorDirty] = useState(false);
  const [savingModerator, setSavingModerator] = useState(false);

  useEffect(() => {
    if (config?.moderator) {
      setModerator(config.moderator);
    }
  }, [config?.moderator]);

  const handleSaveModerator = async () => {
    if (!moderator) return;
    setSavingModerator(true);
    try {
      const response = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateModerator", moderator }),
      });
      if (!response.ok) throw new Error("Failed to save moderator");
      setModeratorDirty(false);
      await refetch();
    } catch (e) {
      console.error("Failed to save moderator:", e);
    } finally {
      setSavingModerator(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!moderator) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
        No moderator configuration found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--accent-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Moderator Settings</h2>
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">Configure the debate moderator behavior</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Moderator Name</label>
            <input
              type="text"
              value={moderator.name}
              onChange={(e) => {
                setModerator({ ...moderator, name: e.target.value });
                setModeratorDirty(true);
              }}
              className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
              Moderator System Prompt
              <span className="text-[var(--foreground-muted)] font-normal ml-2">
                (Include DECISION: CONTINUE/CONCLUDE format instruction)
              </span>
            </label>
            <textarea
              value={moderator.systemPrompt}
              onChange={(e) => {
                setModerator({ ...moderator, systemPrompt: e.target.value });
                setModeratorDirty(true);
              }}
              rows={8}
              className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)] resize-none font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">Maximum Rounds</label>
            <input
              type="number"
              min={1}
              max={20}
              value={moderator.maxRounds}
              onChange={(e) => {
                setModerator({ ...moderator, maxRounds: parseInt(e.target.value) || 5 });
                setModeratorDirty(true);
              }}
              className="w-32 px-3 py-2 border border-[var(--glass-border)] rounded-xl bg-[var(--surface)] text-[var(--foreground)]"
            />
          </div>

          {moderatorDirty && (
            <div className="flex justify-end pt-4 border-t border-[var(--glass-border)]">
              <Button onClick={handleSaveModerator} disabled={savingModerator}>
                <Save className="w-4 h-4 mr-2" />
                {savingModerator ? "Saving..." : "Save Moderator Settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// LLM LOGS TAB COMPONENT
// ============================================================================

function LlmLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs/llm");
      if (!res.ok) {
        if (res.status === 404) {
          setLogs([]);
          return;
        }
        throw new Error("Failed to load logs");
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-[var(--foreground-muted)] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[var(--foreground-muted)] mb-2">No logs yet</h3>
        <p className="text-sm text-[var(--foreground-muted)]">LLM call logs will appear here once you start a debate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-[var(--foreground)]">{logs.length} LLM Calls</h3>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          Refresh
        </Button>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {logs.slice().reverse().map((log, i) => (
          <Card key={log.id || i}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-primary-muted)] text-[var(--accent-primary)]">
                    {log.provider}
                  </span>
                  <span className="text-sm text-[var(--foreground-muted)]">{log.model}</span>
                  {log.purpose && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">
                      {log.purpose}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--foreground-muted)]">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--foreground-muted)]">
                <span>Duration: {log.durationMs}ms</span>
                <span>Tokens: {log.tokensUsed?.total || 0}</span>
                <span className={log.success ? "text-emerald-400" : "text-red-400"}>
                  {log.success ? "Success" : "Failed"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CONFIGURE PAGE
// ============================================================================

function ConfigurePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") || "llm";
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push(`/configure?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="min-h-screen relative">
      {/* Particle Background (subtle/static) */}
      <ParticleBackground particleCount={80} subtle={true} intensity={0.3} />

      {/* Floating Navigation */}
      <FloatingNav showViewToggle={false} position="top-left" />

      {/* Main Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Configure</h1>
          <p className="text-[var(--foreground-muted)] mt-1">Manage LLM providers, agents, and moderator settings</p>
        </div>

        {/* Tabs */}
        <TabsList className="mb-6">
          <TabsTrigger value="llm" active={activeTab === "llm"} onClick={() => handleTabChange("llm")}>
            <Sliders className="w-4 h-4" />
            LLM Providers
          </TabsTrigger>
          <TabsTrigger value="agents" active={activeTab === "agents"} onClick={() => handleTabChange("agents")}>
            <Users className="w-4 h-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="moderator" active={activeTab === "moderator"} onClick={() => handleTabChange("moderator")}>
            <Settings className="w-4 h-4" />
            Moderator
          </TabsTrigger>
          <TabsTrigger value="logs" active={activeTab === "logs"} onClick={() => handleTabChange("logs")}>
            <FileText className="w-4 h-4" />
            LLM Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "llm" && <LLMProvidersTab />}
          {activeTab === "agents" && <AgentsTab />}
          {activeTab === "moderator" && <ModeratorTab />}
          {activeTab === "logs" && <LlmLogsTab />}
        </div>
      </div>
    </div>
  );
}

export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <LoadingSpinner size="lg" />
      </div>
    }>
      <ConfigurePageContent />
    </Suspense>
  );
}
