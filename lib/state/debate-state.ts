/**
 * In-memory Debate State Manager
 */

import type { DebateState, DebateArgument, ModeratorStep, DebateSummary } from "../agents/types";

class DebateStateManager {
  private states: Map<string, DebateState> = new Map();

  /**
   * Create a new debate
   */
  create(config: {
    id: string;
    task: string;
    documentContent?: string;
    documentName?: string;
    activeAgents: string[];
  }): DebateState {
    const state: DebateState = {
      id: config.id,
      status: "idle",
      task: config.task,
      documentContent: config.documentContent,
      documentName: config.documentName,
      activeAgents: config.activeAgents,
      rounds: [],
      currentRound: 0,
    };

    this.states.set(config.id, state);
    return state;
  }

  /**
   * Get debate state
   */
  get(debateId: string): DebateState | undefined {
    return this.states.get(debateId);
  }

  /**
   * Start a debate
   */
  start(debateId: string): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state) return undefined;

    state.status = "debating";
    state.startedAt = new Date();
    state.currentRound = 1;
    state.rounds = [{ number: 1, arguments: [], moderatorSteps: [] }];

    return state;
  }

  /**
   * Add an argument to the current round
   */
  addArgument(debateId: string, argument: DebateArgument): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state || state.rounds.length === 0) return undefined;

    const currentRound = state.rounds[state.rounds.length - 1];
    currentRound.arguments.push(argument);

    return state;
  }

  /**
   * Add a moderator step
   */
  addModeratorStep(debateId: string, step: ModeratorStep): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state || state.rounds.length === 0) return undefined;

    const currentRound = state.rounds[state.rounds.length - 1];
    currentRound.moderatorSteps.push(step);

    return state;
  }

  /**
   * Set the speaking agent
   */
  setSpeakingAgent(debateId: string, agentId: string | undefined): void {
    const state = this.states.get(debateId);
    if (state) {
      state.speakingAgent = agentId;
    }
  }

  /**
   * Complete current round and start next
   */
  nextRound(debateId: string, decision: "continue" | "conclude"): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state || state.rounds.length === 0) return undefined;

    const currentRound = state.rounds[state.rounds.length - 1];
    currentRound.decision = decision;

    if (decision === "continue") {
      state.currentRound++;
      state.rounds.push({
        number: state.currentRound,
        arguments: [],
        moderatorSteps: [],
      });
    } else {
      state.status = "concluding";
    }

    return state;
  }

  /**
   * Complete the debate with summary
   */
  complete(debateId: string, summary: DebateSummary): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state) return undefined;

    state.status = "complete";
    state.summary = summary;
    state.completedAt = new Date();

    return state;
  }

  /**
   * Set error state
   */
  setError(debateId: string, error: string): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state) return undefined;

    state.status = "error";
    state.error = error;

    return state;
  }

  /**
   * Delete a debate
   */
  delete(debateId: string): boolean {
    return this.states.delete(debateId);
  }

  /**
   * List all debates
   */
  list(): DebateState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get all arguments for a debate
   */
  getAllArguments(debateId: string): DebateArgument[] {
    const state = this.states.get(debateId);
    if (!state) return [];

    return state.rounds.flatMap((r) => r.arguments);
  }

  /**
   * Get arguments by agent
   */
  getArgumentsByAgent(debateId: string, agentId: string): DebateArgument[] {
    return this.getAllArguments(debateId).filter((a) => a.agentId === agentId);
  }
}

// Global state manager instance
export const debateStateManager = new DebateStateManager();
