/**
 * Debate Agent - Represents a single persona in the debate
 */

import type { AgentConfig, DebateArgument } from "./types";
import type { LLMClient } from "../llm/types";
import { createLLMClientFromEnv } from "../llm/client";
import { executeReActLoop, type ReActStep } from "../llm/react-loop";
import { toolRegistry } from "../tools/registry";
import { debateEventEmitter } from "../events/emitter";
import {
  getRelevantMemories,
  addMemory,
  recordDebateParticipation,
  type MemoryEntry,
} from "../storage/agent-memory";

export interface DebateContext {
  debateId: string;
  task: string;
  documentContent?: string;
  round: number;
  previousArguments: DebateArgument[];
}

export interface DebateAgentResult {
  argument: DebateArgument;
  reactSteps: ReActStep[];
  tokensUsed: number;
}

export class DebateAgent {
  private config: AgentConfig;
  private client: LLMClient;

  constructor(config: AgentConfig) {
    this.config = config;

    // Create LLM client - use agent-specific config if provided, otherwise use global defaults
    // Pass undefined to let createLLMClientFromEnv use the llm.json defaults
    const provider = config.llm?.provider;
    const model = config.llm?.model;
    this.client = createLLMClientFromEnv(provider, model);
  }

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get color(): string {
    return this.config.color;
  }

  /**
   * Generate an argument for the current debate round
   */
  async generateArgument(context: DebateContext): Promise<DebateAgentResult> {
    const { debateId, task, documentContent, round, previousArguments } = context;

    const startTime = Date.now();
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${this.name}] Starting turn - Round ${round}`);
    console.log(`[${this.name}] Received ${previousArguments.length} previous arguments:`);
    previousArguments.forEach((arg, i) => {
      console.log(`  ${i + 1}. ${arg.agentName}: "${arg.content.substring(0, 80)}..."`);
    });

    // Record debate participation
    if (round === 1) {
      await recordDebateParticipation(this.id).catch(() => {});
    }

    // Fetch relevant memories from past debates
    let memories: MemoryEntry[] = [];
    try {
      memories = await getRelevantMemories(this.id, task, 3);
    } catch {
      // Silently fail if memory retrieval fails
    }

    // Build context from previous arguments
    const previousContext = this.buildPreviousContext(previousArguments);

    // Build the prompt with memories
    const prompt = this.buildPrompt(task, documentContent, round, previousContext, memories);

    console.log(`[${this.name}] Calling LLM...`);

    // Get available tools for this agent
    const tools = toolRegistry.getDefinitionsForNames(this.config.tools);

    // Emit thinking event
    debateEventEmitter.emit(debateId, "agent_thinking", {
      debateId,
      agentId: this.id,
      agentName: this.name,
      round,
    });

    // Execute ReAct loop
    const result = await executeReActLoop(this.client, prompt, {
      systemPrompt: this.buildSystemPrompt(),
      tools,
      toolContext: { documentContent, debateId, agentId: this.id },
      // Logging context
      debateId,
      agentId: this.id,
      agentName: this.name,
      purpose: round === 1 ? "opening" : "rebuttal",
      onStep: (step) => {
        if (step.type === "acting" && step.toolCall) {
          debateEventEmitter.emit(debateId, "agent_tool_use", {
            debateId,
            agentId: this.id,
            agentName: this.name,
            round,
            toolName: step.toolCall.name,
            toolInput: step.toolCall.input,
          });
        }
      },
    });

    // Extract score and confidence from the response
    const { score, confidence, content } = this.parseResponse(result.finalResponse);

    // Create the argument
    const argument: DebateArgument = {
      id: `${this.id}-r${round}-${Date.now()}`,
      agentId: this.id,
      agentName: this.name,
      agentColor: this.color,
      round,
      content,
      score,
      confidence,
      toolsUsed: result.toolsUsed,
      timestamp: new Date(),
    };

    const elapsed = Date.now() - startTime;
    console.log(`[${this.name}] Completed in ${elapsed}ms`);
    console.log(`[${this.name}] Response: "${content.substring(0, 100)}..."`);
    console.log(`${"=".repeat(60)}\n`);

    return {
      argument,
      reactSteps: result.steps,
      tokensUsed: result.totalTokens,
    };
  }

  private buildSystemPrompt(): string {
    // Use only the configured system prompt - no hidden instructions
    return this.config.systemPrompt;
  }

  private buildPrompt(
    task: string,
    documentContent: string | undefined,
    round: number,
    previousContext: string,
    memories: MemoryEntry[] = []
  ): string {
    let prompt = `Topic: ${task}\n`;

    if (documentContent) {
      const truncated = documentContent.length > 4000
        ? documentContent.substring(0, 4000) + "\n[Document truncated...]"
        : documentContent;
      prompt += `\nDocument:\n${truncated}\n`;
    }

    // Include relevant memories from past debates
    if (memories.length > 0) {
      prompt += `\n[Your relevant insights from past debates:`;
      for (const mem of memories) {
        prompt += `\n- (On "${mem.topic}"): ${mem.insight}`;
      }
      prompt += `]\n`;
    }

    prompt += `\nRound: ${round}`;

    if (previousContext) {
      prompt += `\n\nPrevious arguments:\n${previousContext}`;
    }

    prompt += `\n\nProvide your perspective.`;

    return prompt;
  }

  private buildPreviousContext(previousArguments: DebateArgument[]): string {
    if (previousArguments.length === 0) return "";

    // Only show last 3 arguments to keep context short
    const recent = previousArguments.slice(-3);
    return recent
      .map((arg) => `${arg.agentName}: ${arg.content}`)
      .join("\n");
  }

  private parseResponse(response: string): { score?: number; confidence?: number; content: string } {
    let content = response;
    let score: number | undefined;
    let confidence: number | undefined;

    // Extract score
    const scoreMatch = response.match(/SCORE:\s*(\d)/i);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1]);
      content = content.replace(/SCORE:\s*\d/i, "").trim();
    }

    // Extract confidence
    const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
    if (confidenceMatch) {
      confidence = parseFloat(confidenceMatch[1]);
      content = content.replace(/CONFIDENCE:\s*[\d.]+/i, "").trim();
    }

    return { score, confidence, content };
  }
}

/**
 * Create debate agents from config
 */
export function createDebateAgents(configs: AgentConfig[]): DebateAgent[] {
  return configs.map((config) => new DebateAgent(config));
}
