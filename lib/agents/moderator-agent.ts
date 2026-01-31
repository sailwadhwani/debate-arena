/**
 * Moderator Agent - Orchestrates the debate and decides when to conclude
 */

import type { ModeratorConfig, DebateArgument, ModeratorStep, DebateSummary } from "./types";
import type { LLMClient } from "../llm/types";
import { createLLMClientFromEnv } from "../llm/client";
import { executeReActLoop, type ReActStep } from "../llm/react-loop";
import { toolRegistry } from "../tools/registry";
import { debateEventEmitter } from "../events/emitter";

export interface ModeratorContext {
  debateId: string;
  task: string;
  round: number;
  maxRounds: number;
  arguments: DebateArgument[];
}

export interface ModeratorResult {
  decision: "continue" | "conclude";
  reasoning: string;
  steps: ModeratorStep[];
  summary?: DebateSummary;
}

export class ModeratorAgent {
  private config: ModeratorConfig;
  private client: LLMClient;

  constructor(config: ModeratorConfig) {
    this.config = config;

    // Create LLM client - use moderator-specific config if provided, otherwise use global defaults
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

  get maxRounds(): number {
    return this.config.maxRounds;
  }

  /**
   * Evaluate the current round and decide whether to continue or conclude
   */
  async evaluateRound(context: ModeratorContext): Promise<ModeratorResult> {
    const { debateId, task, round, maxRounds, arguments: args } = context;

    // Build the evaluation prompt
    const prompt = this.buildEvaluationPrompt(task, round, maxRounds, args);

    // Get moderator tools
    const tools = toolRegistry.getDefinitionsForNames([
      "evaluate_consensus",
      "identify_conflicts",
      "assess_progress",
    ]);

    const steps: ModeratorStep[] = [];

    // Execute ReAct loop for evaluation
    const result = await executeReActLoop(this.client, prompt, {
      systemPrompt: this.buildSystemPrompt(),
      tools,
      onStep: (step) => {
        const moderatorStep = this.convertToModeratorStep(step);
        steps.push(moderatorStep);
        debateEventEmitter.emit(debateId, "moderator_step", {
          debateId,
          round,
          moderatorStep,
        });
      },
    });

    // Parse the decision from the response
    const { decision, reasoning } = this.parseDecision(result.finalResponse, round, maxRounds);

    // Add final decision step
    const decisionStep: ModeratorStep = {
      type: "decision",
      content: reasoning,
      decision,
      timestamp: new Date(),
    };
    steps.push(decisionStep);
    debateEventEmitter.emit(debateId, "moderator_step", {
      debateId,
      round,
      moderatorStep: decisionStep,
    });

    return { decision, reasoning, steps };
  }

  /**
   * Generate final summary when concluding the debate
   */
  async generateSummary(context: ModeratorContext): Promise<DebateSummary> {
    const { debateId, task, arguments: args } = context;

    const prompt = this.buildSummaryPrompt(task, args);

    // Emit thinking step
    debateEventEmitter.emit(debateId, "moderator_step", {
      debateId,
      moderatorStep: {
        type: "thinking",
        content: "Generating final summary and recommendations...",
        timestamp: new Date(),
      },
    });

    const response = await this.client.complete({
      systemPrompt: this.config.systemPrompt,
      userPrompt: prompt,
    });

    return this.parseSummary(response.content);
  }

  private buildSystemPrompt(): string {
    return `${this.config.systemPrompt}

As the moderator, you must:
1. Use your tools to evaluate the debate's progress
2. Identify areas of agreement and disagreement
3. Decide whether the debate should continue or conclude

DECISION FORMAT:
After your analysis, state your decision clearly:
DECISION: CONTINUE or CONCLUDE
REASONING: [Your explanation]`;
  }

  private buildEvaluationPrompt(
    task: string,
    round: number,
    maxRounds: number,
    args: DebateArgument[]
  ): string {
    const argsSummary = args
      .filter((a) => a.round === round)
      .map((a) => `[${a.agentName}]: Score ${a.score}/5, Confidence ${a.confidence}\n${a.content.substring(0, 300)}...`)
      .join("\n\n");

    return `DEBATE TASK: ${task}

CURRENT ROUND: ${round} of ${maxRounds}

ARGUMENTS THIS ROUND:
${argsSummary}

Please evaluate this round:
1. Use evaluate_consensus to assess agreement levels
2. Use identify_conflicts to find key disagreements
3. Use assess_progress to determine if new points are being made

Based on your analysis, decide whether to CONTINUE the debate or CONCLUDE it.
Consider: Have all perspectives been adequately explored? Is there productive disagreement or just repetition?`;
  }

  private buildSummaryPrompt(task: string, args: DebateArgument[]): string {
    const allArgs = args
      .map((a) => `[${a.agentName} - Round ${a.round}]: Score ${a.score}/5\n${a.content}`)
      .join("\n\n---\n\n");

    return `DEBATE TASK: ${task}

ALL ARGUMENTS:
${allArgs}

Please provide a comprehensive summary of the debate:

1. CONSENSUS LEVEL (0-100): How much agreement was reached?
2. KEY AGREEMENTS: What points did all or most agents agree on?
3. KEY DISAGREEMENTS: What were the main points of contention?
4. RECOMMENDATION: What is your balanced recommendation based on all perspectives?
5. REASONING: Explain how you synthesized the different viewpoints.

Format your response as:
CONSENSUS: [0-100]
KEY_AGREEMENTS:
- [agreement 1]
- [agreement 2]
KEY_DISAGREEMENTS:
- [disagreement 1]
- [disagreement 2]
RECOMMENDATION: [your recommendation]
REASONING: [your explanation]`;
  }

  private convertToModeratorStep(step: ReActStep): ModeratorStep {
    return {
      type: step.type,
      content: step.content,
      toolCall: step.toolCall,
      toolResult: step.toolResult,
      timestamp: step.timestamp,
    };
  }

  private parseDecision(
    response: string,
    round: number,
    maxRounds: number
  ): { decision: "continue" | "conclude"; reasoning: string } {
    // Default to conclude if at max rounds
    if (round >= maxRounds) {
      return {
        decision: "conclude",
        reasoning: "Maximum rounds reached. Proceeding to final summary.",
      };
    }

    // Look for explicit decision
    const decisionMatch = response.match(/DECISION:\s*(CONTINUE|CONCLUDE)/i);
    const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=\n|$)/i);

    if (decisionMatch) {
      return {
        decision: decisionMatch[1].toLowerCase() as "continue" | "conclude",
        reasoning: reasoningMatch?.[1]?.trim() || response,
      };
    }

    // Default: continue if less than halfway through rounds
    return {
      decision: round < maxRounds / 2 ? "continue" : "conclude",
      reasoning: "Based on the analysis, the debate should proceed.",
    };
  }

  private parseSummary(response: string): DebateSummary {
    // Parse consensus
    const consensusMatch = response.match(/CONSENSUS:\s*(\d+)/);
    const consensus = consensusMatch ? parseInt(consensusMatch[1]) : 50;

    // Parse key agreements
    const agreementsMatch = response.match(/KEY_AGREEMENTS:\s*([\s\S]*?)(?=KEY_DISAGREEMENTS:|RECOMMENDATION:|$)/i);
    const keyAgreements = agreementsMatch
      ? agreementsMatch[1].split(/\n-\s*/).filter((s) => s.trim()).map((s) => s.trim())
      : [];

    // Parse key disagreements
    const disagreementsMatch = response.match(/KEY_DISAGREEMENTS:\s*([\s\S]*?)(?=RECOMMENDATION:|$)/i);
    const keyDisagreements = disagreementsMatch
      ? disagreementsMatch[1].split(/\n-\s*/).filter((s) => s.trim()).map((s) => s.trim())
      : [];

    // Parse recommendation
    const recommendationMatch = response.match(/RECOMMENDATION:\s*([\s\S]+?)(?=REASONING:|$)/i);
    const recommendation = recommendationMatch?.[1]?.trim() || "No specific recommendation provided.";

    // Parse reasoning
    const reasoningMatch = response.match(/REASONING:\s*([\s\S]+)$/i);
    const reasoning = reasoningMatch?.[1]?.trim() || response;

    return {
      consensus,
      keyAgreements,
      keyDisagreements,
      recommendation,
      reasoning,
    };
  }
}
