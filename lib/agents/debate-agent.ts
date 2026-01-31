/**
 * Debate Agent - Represents a single persona in the debate
 */

import type { AgentConfig, DebateArgument } from "./types";
import type { LLMClient } from "../llm/types";
import { createLLMClientFromEnv } from "../llm/client";
import { executeReActLoop, type ReActStep } from "../llm/react-loop";
import { toolRegistry } from "../tools/registry";
import { debateEventEmitter } from "../events/emitter";

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

    // Build context from previous arguments
    const previousContext = this.buildPreviousContext(previousArguments);

    // Build the prompt
    const prompt = this.buildPrompt(task, documentContent, round, previousContext);

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

    return {
      argument,
      reactSteps: result.steps,
      tokensUsed: result.totalTokens,
    };
  }

  private buildSystemPrompt(): string {
    return `${this.config.systemPrompt}

IMPORTANT GUIDELINES:
1. You are participating in a structured debate with other agents
2. Your perspective is informed by your role as ${this.config.name} with a ${this.config.bias} approach
3. Use available tools to gather evidence when needed
4. Be concise but thorough - aim for 2-3 paragraphs
5. End your response with a score (1-5) and confidence level (0-1)

RESPONSE FORMAT:
Provide your argument, then on separate lines at the end:
SCORE: [1-5]
CONFIDENCE: [0.0-1.0]`;
  }

  private buildPrompt(
    task: string,
    documentContent: string | undefined,
    round: number,
    previousContext: string
  ): string {
    let prompt = `TASK: ${task}\n\n`;

    if (documentContent) {
      const truncated = documentContent.length > 4000
        ? documentContent.substring(0, 4000) + "\n\n[Document truncated...]"
        : documentContent;
      prompt += `DOCUMENT CONTENT:\n${truncated}\n\n`;
    }

    prompt += `DEBATE ROUND: ${round}\n\n`;

    if (previousContext) {
      prompt += `PREVIOUS ARGUMENTS:\n${previousContext}\n\n`;
    }

    prompt += `Please provide your analysis and argument from your perspective as ${this.config.name}. `;
    prompt += `Remember to include your SCORE (1-5) and CONFIDENCE (0-1) at the end.`;

    return prompt;
  }

  private buildPreviousContext(previousArguments: DebateArgument[]): string {
    if (previousArguments.length === 0) return "";

    return previousArguments
      .map((arg) => `[${arg.agentName} - Round ${arg.round}]:\n${arg.content}\nScore: ${arg.score}/5, Confidence: ${arg.confidence}`)
      .join("\n\n---\n\n");
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
