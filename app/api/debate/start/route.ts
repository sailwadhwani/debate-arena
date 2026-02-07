/**
 * POST /api/debate/start
 *
 * Start a new debate session
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { loadAgentsConfig } from "@/lib/config/loader";
import { debateStateManager } from "@/lib/state/debate-state";
import { debateEventEmitter } from "@/lib/events/emitter";
import { DebateAgent, createDebateAgents } from "@/lib/agents/debate-agent";
import { ModeratorAgent } from "@/lib/agents/moderator-agent";
import { saveDebate } from "@/lib/storage/debate-history";
import { addMemory } from "@/lib/storage/agent-memory";
import type { DebateArgument, DebateRound } from "@/lib/agents/types";

export const maxDuration = 300; // 5 minutes max for long debates

/**
 * Extract a key insight from an argument content
 */
function extractKeyInsight(content: string): string | null {
  if (!content || content.length < 20) return null;

  // Get the first substantive sentence (skip greetings, etc.)
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  if (sentences.length === 0) return null;

  // Return the first substantial sentence, truncated if necessary
  const insight = sentences[0];
  return insight.length > 200 ? insight.substring(0, 200) + "..." : insight;
}

interface StartDebateRequest {
  task: string;
  documentContent?: string;
  documentName?: string;
  selectedAgents?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: StartDebateRequest = await request.json();
    const { task, documentContent, documentName, selectedAgents } = body;

    if (!task) {
      return NextResponse.json({ error: "Task is required" }, { status: 400 });
    }

    // Load agent config
    const config = await loadAgentsConfig();

    // Filter to selected agents or use all
    const activeAgentConfigs = selectedAgents
      ? config.agents.filter((a) => selectedAgents.includes(a.id))
      : config.agents;

    if (activeAgentConfigs.length < 2) {
      return NextResponse.json(
        { error: "At least 2 agents are required for a debate" },
        { status: 400 }
      );
    }

    // Create debate ID
    const debateId = `debate-${Date.now()}`;

    // Initialize debate state
    const state = debateStateManager.create({
      id: debateId,
      task,
      documentContent,
      documentName,
      activeAgents: activeAgentConfigs.map((a) => a.id),
    });

    // Return immediately with debate ID
    const response = NextResponse.json({
      debateId,
      status: "starting",
      agents: activeAgentConfigs.map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        role: a.role,
      })),
    });

    // Start debate in background
    runDebate(debateId, task, documentContent, activeAgentConfigs, config.moderator).catch(
      (error) => {
        console.error(`[Debate ${debateId}] Error:`, error);
        debateStateManager.setError(debateId, error.message);
        debateEventEmitter.emit(debateId, "debate_error", {
          debateId,
          error: error.message,
        });
      }
    );

    return response;
  } catch (error) {
    console.error("[API /debate/start] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start debate" },
      { status: 500 }
    );
  }
}

async function runDebate(
  debateId: string,
  task: string,
  documentContent: string | undefined,
  agentConfigs: import("@/lib/agents/types").AgentConfig[],
  moderatorConfig: import("@/lib/agents/types").ModeratorConfig
) {
  // Create agents
  const agents = createDebateAgents(agentConfigs);
  const moderator = new ModeratorAgent(moderatorConfig);

  // Start the debate
  debateStateManager.start(debateId);
  debateEventEmitter.emit(debateId, "debate_started", {
    debateId,
    task,
    agents: agentConfigs.map((a) => ({ id: a.id, name: a.name, color: a.color })),
  });

  let round = 1;
  const maxRounds = moderator.maxRounds;
  let shouldContinue = true;

  while (shouldContinue && round <= maxRounds) {
    // Emit round started
    debateEventEmitter.emit(debateId, "round_started", {
      debateId,
      round,
    });

    // Collect all arguments from this round
    const roundArguments: DebateArgument[] = [];

    // Get all previous arguments
    const previousArguments = debateStateManager.getAllArguments(debateId);

    // Each agent provides their argument
    for (const agent of agents) {
      debateStateManager.setSpeakingAgent(debateId, agent.id);

      const result = await agent.generateArgument({
        debateId,
        task,
        documentContent,
        round,
        previousArguments: [...previousArguments, ...roundArguments],
      });

      roundArguments.push(result.argument);
      debateStateManager.addArgument(debateId, result.argument);

      // Emit the argument
      debateEventEmitter.emit(debateId, "agent_argument", {
        debateId,
        round,
        agentId: agent.id,
        agentName: agent.name,
        argument: result.argument,
      });
    }

    debateStateManager.setSpeakingAgent(debateId, undefined);

    // Moderator evaluates the round
    const moderatorResult = await moderator.evaluateRound({
      debateId,
      task,
      round,
      maxRounds,
      arguments: [...previousArguments, ...roundArguments],
    });

    // Update state based on decision
    debateStateManager.nextRound(debateId, moderatorResult.decision);

    // Emit round complete
    debateEventEmitter.emit(debateId, "round_complete", {
      debateId,
      round,
      decision: moderatorResult.decision,
      reasoning: moderatorResult.reasoning,
    });

    if (moderatorResult.decision === "conclude") {
      shouldContinue = false;
    } else {
      round++;
    }
  }

  // Generate final summary
  const allArguments = debateStateManager.getAllArguments(debateId);
  const summary = await moderator.generateSummary({
    debateId,
    task,
    round,
    maxRounds,
    arguments: allArguments,
  });

  // Complete the debate
  debateStateManager.complete(debateId, summary);

  // Save debate to history
  try {
    const rounds: DebateRound[] = [];
    let currentRound = 1;
    let currentRoundArgs: DebateArgument[] = [];

    for (const arg of allArguments) {
      if (arg.round !== currentRound) {
        rounds.push({
          number: currentRound,
          arguments: currentRoundArgs,
          moderatorSteps: [],
        });
        currentRound = arg.round;
        currentRoundArgs = [arg];
      } else {
        currentRoundArgs.push(arg);
      }
    }

    // Push the last round
    if (currentRoundArgs.length > 0) {
      rounds.push({
        number: currentRound,
        arguments: currentRoundArgs,
        moderatorSteps: [],
      });
    }

    await saveDebate({
      id: debateId,
      topic: task,
      agents: agentConfigs.map((a) => ({ id: a.id, name: a.name, color: a.color })),
      rounds,
      moderatorSteps: [],
      summary,
      createdAt: new Date(parseInt(debateId.split("-")[1])).toISOString(),
      completedAt: new Date().toISOString(),
    });
    console.log(`[Debate ${debateId}] Saved to history`);

    // Save key insights to agent memories
    for (const arg of allArguments) {
      // Extract a key insight from arguments (first sentence or key point)
      const insight = extractKeyInsight(arg.content);
      if (insight) {
        await addMemory(arg.agentId, task, insight, {
          debateId,
          round: arg.round,
        }).catch(() => {}); // Silently fail
      }
    }
    console.log(`[Debate ${debateId}] Agent memories updated`);
  } catch (err) {
    console.error(`[Debate ${debateId}] Failed to save to history:`, err);
  }

  // Emit completion
  debateEventEmitter.emit(debateId, "debate_complete", {
    debateId,
    summary,
    totalRounds: round,
  });
}
