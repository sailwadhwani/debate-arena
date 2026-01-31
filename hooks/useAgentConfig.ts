"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentsConfig, AgentConfig } from "@/lib/agents/types";

interface UseAgentConfigResult {
  config: AgentsConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateAgent: (id: string, updates: Partial<AgentConfig>) => Promise<void>;
  addAgent: (agent: AgentConfig) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  reorderAgents: (agentIds: string[]) => Promise<void>;
}

export function useAgentConfig(): UseAgentConfigResult {
  const [config, setConfig] = useState<AgentsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agents");
      if (!response.ok) {
        throw new Error("Failed to load agent config");
      }
      const data = await response.json();
      setConfig(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAgent = useCallback(async (id: string, updates: Partial<AgentConfig>) => {
    try {
      const response = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", agentId: id, updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update agent");
      }

      // Refetch to get updated config
      await fetchConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      throw e;
    }
  }, [fetchConfig]);

  const addAgent = useCallback(async (agent: AgentConfig) => {
    try {
      const response = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", agent }),
      });

      if (!response.ok) {
        throw new Error("Failed to add agent");
      }

      await fetchConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      throw e;
    }
  }, [fetchConfig]);

  const deleteAgent = useCallback(async (id: string) => {
    try {
      const response = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", agentId: id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete agent");
      }

      await fetchConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      throw e;
    }
  }, [fetchConfig]);

  const reorderAgents = useCallback(async (agentIds: string[]) => {
    if (!config) return;

    try {
      // Reorder agents based on the provided ID order
      const reorderedAgents = agentIds
        .map(id => config.agents.find(a => a.id === id))
        .filter((a): a is AgentConfig => a !== undefined);

      const newConfig = {
        ...config,
        agents: reorderedAgents,
      };

      const response = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveAll", config: newConfig }),
      });

      if (!response.ok) {
        throw new Error("Failed to reorder agents");
      }

      // Update local state immediately for responsiveness
      setConfig(newConfig);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      throw e;
    }
  }, [config]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
    updateAgent,
    addAgent,
    deleteAgent,
    reorderAgents,
  };
}
