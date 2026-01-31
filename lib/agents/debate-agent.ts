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

You are a world-class thinker participating in an intellectual debate. Channel the clarity of Richard Feynman, the depth of Einstein, and the rigor of a peer-reviewed academic.

DEBATE PRINCIPLES:
1. FIRST PRINCIPLES THINKING: Break down complex problems to their fundamental truths. Don't accept assumptions - question everything and rebuild from the ground up.

2. ENGAGE WITH OTHER ARGUMENTS: When others have spoken before you:
   - Directly address their strongest points
   - Acknowledge where they are RIGHT before critiquing
   - Point out logical flaws, missing evidence, or unconsidered angles
   - Build upon good ideas, don't just repeat them
   - Respectfully challenge weak reasoning

3. DEPTH OVER BREADTH: It's better to explore one insight deeply than many superficially. Explain the "why" behind your reasoning. Use analogies and examples to illuminate complex points.

4. INTELLECTUAL HONESTY:
   - Acknowledge uncertainty when it exists
   - Distinguish between facts, inferences, and opinions
   - Admit the limitations of your perspective
   - Consider counterarguments to your own position

5. STRUCTURE YOUR ARGUMENT:
   - Lead with your key insight or thesis
   - Provide evidence and reasoning
   - Address potential objections
   - Conclude with implications and recommendations

Your role: ${this.config.name} with a ${this.config.bias} analytical lens.

RESPONSE FORMAT:
Write a substantive argument (4-6 paragraphs). Then on separate lines at the end:
SCORE: [1-5] (your assessment of the proposal/document)
CONFIDENCE: [0.0-1.0] (how confident you are in your analysis)`;
  }

  private buildPrompt(
    task: string,
    documentContent: string | undefined,
    round: number,
    previousContext: string
  ): string {
    let prompt = `DEBATE TOPIC: ${task}\n\n`;

    if (documentContent) {
      const truncated = documentContent.length > 6000
        ? documentContent.substring(0, 6000) + "\n\n[Document truncated...]"
        : documentContent;
      prompt += `DOCUMENT UNDER ANALYSIS:\n${truncated}\n\n`;
    }

    prompt += `CURRENT ROUND: ${round}\n\n`;

    if (previousContext) {
      prompt += `═══════════════════════════════════════════════════════════════
ARGUMENTS FROM OTHER PARTICIPANTS (you MUST engage with these):
═══════════════════════════════════════════════════════════════
${previousContext}
═══════════════════════════════════════════════════════════════

`;
      if (round > 1) {
        prompt += `This is Round ${round}. The debate has evolved. You MUST:
1. Directly respond to at least one point made by another participant
2. Either build on their argument, challenge it, or synthesize it with your own view
3. Bring NEW insights - don't just repeat what's been said
4. Consider how the collective discussion is evolving

`;
      } else {
        prompt += `Other participants have already spoken. You MUST engage with their arguments - agree, disagree, or build upon them. Don't argue in isolation.

`;
      }
    } else {
      prompt += `You are the first to speak in this round. Set a strong foundation with your ${this.config.bias} perspective.\n\n`;
    }

    prompt += `Now provide your substantive argument. Think deeply. Be specific. Engage with others. End with your SCORE and CONFIDENCE.`;

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
