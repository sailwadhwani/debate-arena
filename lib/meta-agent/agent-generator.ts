/**
 * Agent Generator
 * Generates debate agent configurations from perspectives
 */

import { createLLMClientFromEnv } from "../llm/client";
import { getAgentGenerationPrompt } from "./prompt-templates";
import { loadMemory, recordGeneratedAgent, addEvolutionEvent, generateId } from "./memory";
import { addAgent } from "../config/loader";
import type {
  SuggestedPerspective,
  AgentGenerationRequest,
  AgentGenerationResult,
  Instruction,
} from "./types";
import type { AgentConfig, AgentRole, AgentBias, AvatarType } from "../agents/types";

/**
 * Generate agent configurations from perspectives
 */
export async function generateAgents(
  request: AgentGenerationRequest
): Promise<AgentGenerationResult> {
  const { topic, perspectives, userContext } = request;

  // Load instructions from memory
  const memory = await loadMemory();
  const agentInstructions = memory.instructions.filter(
    (i) => i.active && i.category === "agent-generation"
  );

  const client = await createLLMClientFromEnv();
  const prompt = getAgentGenerationPrompt(
    topic,
    perspectives,
    userContext,
    agentInstructions
  );

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt:
      "You are an expert at creating debate agent configurations. Generate agents that will produce engaging, insightful debates. Always respond with valid JSON.",
    maxTokens: 3000,
    temperature: 0.7,
  });

  // Extract JSON from the response
  const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) {
    try {
      const result = JSON.parse(response.content) as AgentGenerationResult;
      return normalizeResult(result, perspectives);
    } catch {
      return createDefaultAgents(perspectives);
    }
  }

  try {
    const result = JSON.parse(jsonMatch[1]) as AgentGenerationResult;
    return normalizeResult(result, perspectives);
  } catch {
    return createDefaultAgents(perspectives);
  }
}

/**
 * Normalize and validate agent configurations
 */
function normalizeResult(
  result: Partial<AgentGenerationResult>,
  perspectives: SuggestedPerspective[]
): AgentGenerationResult {
  const agents = (result.agents || []).map((agent, index) => {
    const perspective = perspectives[index];
    return normalizeAgent(agent, perspective);
  });

  return {
    agents,
    explanation: result.explanation || "Agents generated based on the provided perspectives.",
    suggestedModeratorPrompt: result.suggestedModeratorPrompt,
  };
}

/**
 * Normalize a single agent configuration
 */
function normalizeAgent(
  agent: Partial<AgentConfig>,
  perspective?: SuggestedPerspective
): AgentConfig {
  const validRoles: AgentRole[] = ["compliance", "business", "product", "technical", "custom"];
  const validBiases: AgentBias[] = ["cautious", "optimistic", "balanced", "pragmatic", "neutral"];
  const validAvatars: AvatarType[] = ["shield", "briefcase", "package", "cpu", "user", "bot"];

  return {
    id: agent.id || generateId(),
    name: agent.name || perspective?.name || "Agent",
    role: validRoles.includes(agent.role as AgentRole) ? agent.role as AgentRole : "custom",
    avatar: validAvatars.includes(agent.avatar as AvatarType)
      ? agent.avatar as AvatarType
      : perspective?.suggestedAvatar || "user",
    color: agent.color || perspective?.suggestedColor || "#4ecdc4",
    systemPrompt: agent.systemPrompt || generateDefaultSystemPrompt(perspective),
    bias: validBiases.includes(agent.bias as AgentBias)
      ? agent.bias as AgentBias
      : perspective?.bias || "balanced",
    tools: agent.tools || ["web_search", "query_document"],
  };
}

/**
 * Generate a default system prompt from a perspective
 */
function generateDefaultSystemPrompt(perspective?: SuggestedPerspective): string {
  if (!perspective) {
    return "You are a debate participant. Present your arguments clearly and respond to others thoughtfully.";
  }

  return `You are ${perspective.name}, a ${perspective.role}. ${perspective.viewpoint}

Your key arguments include:
${perspective.keyArguments.map((a) => `- ${a}`).join("\n")}

Debate style: Be ${perspective.bias}. Present your perspective clearly but consider other viewpoints. Keep responses concise (2-4 sentences per point).`;
}

/**
 * Create default agents when LLM fails
 */
function createDefaultAgents(
  perspectives: SuggestedPerspective[]
): AgentGenerationResult {
  const agents = perspectives.map((p, index) => ({
    id: `agent-${generateId()}`,
    name: p.name,
    role: "custom" as AgentRole,
    avatar: p.suggestedAvatar || "user",
    color: p.suggestedColor,
    systemPrompt: generateDefaultSystemPrompt(p),
    bias: p.bias,
    tools: ["web_search", "query_document"],
  }));

  return {
    agents,
    explanation: "Default agents created from perspectives.",
  };
}

/**
 * Save generated agents to the config file
 */
export async function saveGeneratedAgents(
  agents: AgentConfig[],
  topic: string
): Promise<{ saved: AgentConfig[]; errors: string[] }> {
  const saved: AgentConfig[] = [];
  const errors: string[] = [];

  // Load existing config to check for ID conflicts
  const { loadAgentsConfig } = await import("../config/loader");
  const existingConfig = await loadAgentsConfig();
  const existingIds = new Set(existingConfig.agents.map((a) => a.id));

  for (const agent of agents) {
    try {
      // Ensure unique ID by appending timestamp if ID exists
      let uniqueAgent = agent;
      if (existingIds.has(agent.id)) {
        const uniqueId = `${agent.id}-${Date.now()}`;
        uniqueAgent = { ...agent, id: uniqueId };
      }
      existingIds.add(uniqueAgent.id); // Track for subsequent agents in this batch

      const savedAgent = await addAgent(uniqueAgent);
      saved.push(savedAgent);

      // Record in memory
      await recordGeneratedAgent({
        id: generateId(),
        config: savedAgent,
        generatedFor: topic,
        createdAt: new Date().toISOString(),
      });

      // Log evolution event
      await addEvolutionEvent({
        type: "agent-created",
        description: `Created agent "${savedAgent.name}" for topic: ${topic}`,
        details: { agentId: savedAgent.id, topic },
      });
    } catch (error) {
      errors.push(`Failed to save agent ${agent.name}: ${error}`);
    }
  }

  return { saved, errors };
}

/**
 * Modify an existing agent based on feedback
 */
export async function modifyAgent(
  agentId: string,
  feedback: string,
  currentAgent: AgentConfig
): Promise<AgentConfig> {
  const client = await createLLMClientFromEnv();

  const prompt = `Modify the following agent configuration based on user feedback.

Current Agent:
${JSON.stringify(currentAgent, null, 2)}

User Feedback: "${feedback}"

Respond with the modified agent configuration in JSON:
\`\`\`json
{
  "id": "...",
  "name": "...",
  "role": "...",
  "avatar": "...",
  "color": "...",
  "systemPrompt": "...",
  "bias": "...",
  "tools": [...]
}
\`\`\`

Only modify what the feedback requests. Keep other properties unchanged.`;

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt: "You are an expert at modifying agent configurations. Respond with valid JSON.",
    maxTokens: 1000,
    temperature: 0.5,
  });

  try {
    const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
    const json = jsonMatch ? jsonMatch[1] : response.content;
    const modified = JSON.parse(json) as AgentConfig;
    return normalizeAgent({ ...currentAgent, ...modified });
  } catch {
    return currentAgent;
  }
}

/**
 * Generate a moderator prompt for a specific topic
 */
export async function generateModeratorPrompt(
  topic: string,
  agents: AgentConfig[]
): Promise<string> {
  const client = await createLLMClientFromEnv();

  const agentNames = agents.map((a) => a.name).join(", ");
  const prompt = `Generate a moderator system prompt for a debate on "${topic}" with the following participants: ${agentNames}.

The moderator should:
1. Ensure all perspectives are heard
2. Identify points of agreement and disagreement
3. Recognize when debate has reached productive conclusion
4. Synthesize a balanced final assessment

Respond with just the moderator prompt text, no JSON wrapper.`;

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt: "You are an expert at creating moderator prompts for debates.",
    maxTokens: 800,
    temperature: 0.6,
  });

  return response.content;
}

/**
 * Apply user instructions to agent generation
 */
export function applyInstructions(
  agents: AgentConfig[],
  instructions: Instruction[]
): AgentConfig[] {
  let modified = [...agents];

  for (const instruction of instructions) {
    if (!instruction.active) continue;

    // Parse instruction for common patterns
    const content = instruction.content.toLowerCase();

    // Handle "always create N agents" instruction
    const countMatch = content.match(/always create (\d+) agents/);
    if (countMatch) {
      const targetCount = parseInt(countMatch[1]);
      if (modified.length > targetCount) {
        modified = modified.slice(0, targetCount);
      }
      // Note: We can't add agents here, that's handled in generation
    }

    // Handle "always include X tool" instruction
    const toolMatch = content.match(/always include (\w+) tool/);
    if (toolMatch) {
      const tool = toolMatch[1];
      modified = modified.map((a) => ({
        ...a,
        tools: a.tools.includes(tool) ? a.tools : [...a.tools, tool],
      }));
    }

    // Handle bias preferences
    if (content.includes("more cautious")) {
      modified = modified.map((a) => ({
        ...a,
        systemPrompt: a.systemPrompt + " Be extra cautious and consider risks carefully.",
      }));
    }
  }

  return modified;
}
