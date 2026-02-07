/**
 * In-memory Debate State Manager
 */

import type { DebateState, DebateArgument, ModeratorStep, DebateSummary } from "../agents/types";

export interface ViewerReaction {
  argumentId: string;
  viewerId: string;
  type: "agree" | "disagree";
  timestamp: Date;
}

export interface DebateViewerState {
  viewerCount: number;
  viewers: Set<string>;
  reactions: Map<string, ViewerReaction[]>; // argumentId -> reactions
}

class DebateStateManager {
  private states: Map<string, DebateState> = new Map();
  private viewerStates: Map<string, DebateViewerState> = new Map();

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
   * Pause a debate
   */
  pause(debateId: string): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state) return undefined;

    // Only allow pausing during active debate
    if (state.status === "debating") {
      state.status = "paused";
    }

    return state;
  }

  /**
   * Resume a paused debate
   */
  resume(debateId: string): DebateState | undefined {
    const state = this.states.get(debateId);
    if (!state) return undefined;

    // Only allow resuming from paused state
    if (state.status === "paused") {
      state.status = "debating";
    }

    return state;
  }

  /**
   * Check if debate is paused
   */
  isPaused(debateId: string): boolean {
    const state = this.states.get(debateId);
    return state?.status === "paused";
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

  /**
   * Add a viewer to a debate
   */
  addViewer(debateId: string, viewerId: string): number {
    let viewerState = this.viewerStates.get(debateId);
    if (!viewerState) {
      viewerState = {
        viewerCount: 0,
        viewers: new Set(),
        reactions: new Map(),
      };
      this.viewerStates.set(debateId, viewerState);
    }

    if (!viewerState.viewers.has(viewerId)) {
      viewerState.viewers.add(viewerId);
      viewerState.viewerCount = viewerState.viewers.size;
    }

    return viewerState.viewerCount;
  }

  /**
   * Remove a viewer from a debate
   */
  removeViewer(debateId: string, viewerId: string): number {
    const viewerState = this.viewerStates.get(debateId);
    if (!viewerState) return 0;

    viewerState.viewers.delete(viewerId);
    viewerState.viewerCount = viewerState.viewers.size;

    return viewerState.viewerCount;
  }

  /**
   * Get viewer count
   */
  getViewerCount(debateId: string): number {
    return this.viewerStates.get(debateId)?.viewerCount || 0;
  }

  /**
   * Add a reaction to an argument
   */
  addReaction(debateId: string, argumentId: string, viewerId: string, type: "agree" | "disagree"): ViewerReaction[] {
    let viewerState = this.viewerStates.get(debateId);
    if (!viewerState) {
      viewerState = {
        viewerCount: 0,
        viewers: new Set(),
        reactions: new Map(),
      };
      this.viewerStates.set(debateId, viewerState);
    }

    let reactions = viewerState.reactions.get(argumentId);
    if (!reactions) {
      reactions = [];
      viewerState.reactions.set(argumentId, reactions);
    }

    // Remove existing reaction from this viewer
    const existingIndex = reactions.findIndex((r) => r.viewerId === viewerId);
    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1);
    }

    // Add new reaction
    reactions.push({
      argumentId,
      viewerId,
      type,
      timestamp: new Date(),
    });

    return reactions;
  }

  /**
   * Get reactions for an argument
   */
  getReactions(debateId: string, argumentId: string): { agree: number; disagree: number } {
    const viewerState = this.viewerStates.get(debateId);
    if (!viewerState) return { agree: 0, disagree: 0 };

    const reactions = viewerState.reactions.get(argumentId) || [];
    return {
      agree: reactions.filter((r) => r.type === "agree").length,
      disagree: reactions.filter((r) => r.type === "disagree").length,
    };
  }

  /**
   * Get all reactions for a debate
   */
  getAllReactions(debateId: string): Map<string, { agree: number; disagree: number }> {
    const viewerState = this.viewerStates.get(debateId);
    if (!viewerState) return new Map();

    const result = new Map<string, { agree: number; disagree: number }>();
    for (const [argumentId, reactions] of viewerState.reactions) {
      result.set(argumentId, {
        agree: reactions.filter((r) => r.type === "agree").length,
        disagree: reactions.filter((r) => r.type === "disagree").length,
      });
    }
    return result;
  }

  /**
   * Generate a shareable link code
   */
  generateShareCode(debateId: string): string {
    const state = this.states.get(debateId);
    if (!state) return "";

    // Simple encoding - in production, you'd use a proper short link service
    return Buffer.from(debateId).toString("base64url");
  }

  /**
   * Decode a share code
   */
  decodeShareCode(code: string): string | null {
    try {
      return Buffer.from(code, "base64url").toString();
    } catch {
      return null;
    }
  }
}

// Global state manager instance using globalThis to persist across module reloads
// This is necessary because Next.js may create separate module instances for different API routes
const globalForDebate = globalThis as unknown as {
  debateStateManager: DebateStateManager | undefined;
};

export const debateStateManager =
  globalForDebate.debateStateManager ?? new DebateStateManager();

if (process.env.NODE_ENV !== "production") {
  globalForDebate.debateStateManager = debateStateManager;
}
