/**
 * Configuration Loader
 *
 * Loads and manages configuration from JSON files
 */

import { promises as fs } from "fs";
import path from "path";
import type { AgentsConfig, AgentConfig, ModeratorConfig } from "../agents/types";

const CONFIG_DIR = path.join(process.cwd(), "config");

/**
 * Load agents configuration
 */
export async function loadAgentsConfig(): Promise<AgentsConfig> {
  try {
    const filePath = path.join(CONFIG_DIR, "agents.json");
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to load agents config:", error);
    return getDefaultAgentsConfig();
  }
}

/**
 * Save agents configuration
 */
export async function saveAgentsConfig(config: AgentsConfig): Promise<void> {
  const filePath = path.join(CONFIG_DIR, "agents.json");
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}

/**
 * Load LLM configuration
 */
export async function loadLLMConfig(): Promise<Record<string, unknown>> {
  try {
    const filePath = path.join(CONFIG_DIR, "llm.json");
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to load LLM config:", error);
    return getDefaultLLMConfig();
  }
}

/**
 * Load tools configuration
 */
export async function loadToolsConfig(): Promise<Record<string, unknown>> {
  try {
    const filePath = path.join(CONFIG_DIR, "tools.json");
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to load tools config:", error);
    return { tools: [] };
  }
}

/**
 * Get a specific agent by ID
 */
export async function getAgentById(id: string): Promise<AgentConfig | undefined> {
  const config = await loadAgentsConfig();
  return config.agents.find((a) => a.id === id);
}

/**
 * Update a specific agent
 */
export async function updateAgent(id: string, updates: Partial<AgentConfig>): Promise<AgentConfig | undefined> {
  const config = await loadAgentsConfig();
  const index = config.agents.findIndex((a) => a.id === id);

  if (index === -1) return undefined;

  config.agents[index] = { ...config.agents[index], ...updates };
  await saveAgentsConfig(config);
  return config.agents[index];
}

/**
 * Add a new agent
 */
export async function addAgent(agent: AgentConfig): Promise<AgentConfig> {
  const config = await loadAgentsConfig();
  config.agents.push(agent);
  await saveAgentsConfig(config);
  return agent;
}

/**
 * Delete an agent
 */
export async function deleteAgent(id: string): Promise<boolean> {
  const config = await loadAgentsConfig();
  const index = config.agents.findIndex((a) => a.id === id);

  if (index === -1) return false;

  config.agents.splice(index, 1);
  await saveAgentsConfig(config);
  return true;
}

/**
 * Update moderator config
 */
export async function updateModerator(updates: Partial<ModeratorConfig>): Promise<ModeratorConfig> {
  const config = await loadAgentsConfig();
  config.moderator = { ...config.moderator, ...updates };
  await saveAgentsConfig(config);
  return config.moderator;
}

/**
 * Default agents configuration
 */
function getDefaultAgentsConfig(): AgentsConfig {
  return {
    agents: [
      {
        id: "compliance-counsel",
        name: "Compliance Counsel",
        role: "compliance",
        avatar: "shield",
        color: "#ef4444",
        systemPrompt: "You are a compliance expert focused on regulatory requirements...",
        bias: "cautious",
        tools: ["web_search", "query_document"],
      },
      {
        id: "business-strategist",
        name: "Business Strategist",
        role: "business",
        avatar: "briefcase",
        color: "#3b82f6",
        systemPrompt: "You are a business strategist focused on ROI and opportunities...",
        bias: "optimistic",
        tools: ["web_search", "calculator", "query_document"],
      },
      {
        id: "product-manager",
        name: "Product Manager",
        role: "product",
        avatar: "package",
        color: "#10b981",
        systemPrompt: "You are a PM focused on user needs and feature prioritization...",
        bias: "balanced",
        tools: ["web_search", "query_document"],
      },
    ],
    moderator: {
      id: "moderator",
      name: "Debate Moderator",
      systemPrompt: "You are an impartial moderator...",
      maxRounds: 5,
    },
  };
}

/**
 * Default LLM configuration
 */
function getDefaultLLMConfig(): Record<string, unknown> {
  return {
    providers: {
      claude: { apiKeyEnv: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-20250514" },
      openai: { apiKeyEnv: "OPENAI_API_KEY", defaultModel: "gpt-4-turbo" },
      gemini: { apiKeyEnv: "GOOGLE_AI_API_KEY", defaultModel: "gemini-2.5-flash" },
      ollama: { endpoint: "http://localhost:11434", defaultModel: "llama2" },
    },
    defaults: { provider: "claude", temperature: 0.3, maxTokens: 4096 },
  };
}
