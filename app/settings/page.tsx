"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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

const PROVIDER_INFO = {
  claude: {
    name: "Claude (Anthropic)",
    envVar: "ANTHROPIC_API_KEY",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    hasEndpoint: false,
    color: "#D97706",
  },
  openai: {
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    models: ["gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    hasEndpoint: false,
    color: "#10B981",
  },
  gemini: {
    name: "Google Gemini",
    envVar: "GOOGLE_AI_API_KEY",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    hasEndpoint: false,
    color: "#3B82F6",
  },
  ollama: {
    name: "Ollama (Local)",
    envVar: null,
    models: ["qwen2.5:3b", "llama3.2", "llama3.1", "mistral", "codellama", "mixtral"],
    hasEndpoint: true,
    color: "#8B5CF6",
  },
};

export default function SettingsPage() {
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, "testing" | "success" | "error" | null>>({});

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/debate"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </Link>
              <h1 className="text-xl font-semibold">LLM Settings</h1>
            </div>
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
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Settings saved successfully!
          </div>
        )}

        {/* Default Provider */}
        <Card className="mb-6 bg-gray-900 border-gray-800">
          <CardHeader>
            <h2 className="text-lg font-semibold">Default Provider</h2>
            <p className="text-sm text-gray-400">Select the default LLM provider for debates</p>
          </CardHeader>
          <CardContent>
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
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-gray-700 hover:border-gray-600 bg-gray-800/50"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full mx-auto mb-2"
                      style={{ backgroundColor: info.color }}
                    />
                    <span className="text-sm font-medium">{info.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
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
                        ? {
                            ...c,
                            defaults: { ...c.defaults, temperature: parseFloat(e.target.value) },
                          }
                        : c
                    )
                  }
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Precise (0)</span>
                  <span className="text-cyan-400">{config?.defaults.temperature}</span>
                  <span>Creative (1)</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={config?.defaults.maxTokens || 4096}
                  onChange={(e) =>
                    setConfig((c) =>
                      c
                        ? {
                            ...c,
                            defaults: { ...c.defaults, maxTokens: parseInt(e.target.value) || 4096 },
                          }
                        : c
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Configs */}
        <div className="space-y-6">
          {(Object.keys(PROVIDER_INFO) as Array<keyof typeof PROVIDER_INFO>).map((key) => {
            const info = PROVIDER_INFO[key];
            const providerConfig = config?.providers[key];
            const testResult = testResults[key];

            return (
              <Card key={key} className="bg-gray-900 border-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      <h2 className="text-lg font-semibold">{info.name}</h2>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm text-gray-400">Enabled</span>
                      <div
                        className={`w-10 h-6 rounded-full transition-colors relative ${
                          providerConfig?.enabled ? "bg-cyan-500" : "bg-gray-700"
                        }`}
                        onClick={() => updateProvider(key, "enabled", !providerConfig?.enabled)}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            providerConfig?.enabled ? "translate-x-5" : "translate-x-1"
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
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        API Key
                        <span className="text-gray-500 font-normal ml-2">
                          (or set {info.envVar} env var)
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showKeys[key] ? "text" : "password"}
                          value={providerConfig?.apiKey || ""}
                          onChange={(e) => updateProvider(key, "apiKey", e.target.value)}
                          placeholder={`sk-...`}
                          className="w-full px-3 py-2 pr-10 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none font-mono text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys((s) => ({ ...s, [key]: !s[key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showKeys[key] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Endpoint (Ollama) */}
                  {info.hasEndpoint && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Endpoint URL
                      </label>
                      <input
                        type="text"
                        value={providerConfig?.endpoint || "http://localhost:11434"}
                        onChange={(e) => updateProvider(key, "endpoint", e.target.value)}
                        placeholder="http://localhost:11434"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none font-mono text-sm"
                      />
                    </div>
                  )}

                  {/* Model Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Default Model
                    </label>
                    <select
                      value={providerConfig?.defaultModel || info.models[0]}
                      onChange={(e) => updateProvider(key, "defaultModel", e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
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
                      onClick={() => testConnection(key)}
                      disabled={testResult === "testing"}
                    >
                      {testResult === "testing" ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
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
          })}
        </div>
      </main>
    </div>
  );
}
