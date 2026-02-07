/**
 * Debate History Storage
 * Saves and retrieves completed debates for replay
 */

import { promises as fs } from "fs";
import path from "path";
import type { DebateRound, DebateSummary, ModeratorStep } from "../agents/types";

const HISTORY_DIR = path.join(process.cwd(), "data", "debates");

export interface SavedDebate {
  id: string;
  topic: string;
  agents: { id: string; name: string; color: string }[];
  rounds: DebateRound[];
  moderatorSteps: ModeratorStep[];
  summary?: DebateSummary;
  createdAt: string;
  completedAt: string;
  documentName?: string;
  // Branch information
  parentDebateId?: string;
  branchPoint?: {
    round: number;
    argumentIndex: number;
  };
  branches?: string[]; // IDs of debates branched from this one
}

export interface DebateListItem {
  id: string;
  topic: string;
  agentNames: string[];
  roundCount: number;
  consensus?: number;
  createdAt: string;
  completedAt: string;
}

/**
 * Ensure the history directory exists
 */
async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

/**
 * Save a completed debate
 */
export async function saveDebate(debate: SavedDebate): Promise<void> {
  await ensureHistoryDir();
  const filePath = path.join(HISTORY_DIR, `${debate.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(debate, null, 2));
}

/**
 * Get a debate by ID
 */
export async function getDebate(id: string): Promise<SavedDebate | null> {
  try {
    const filePath = path.join(HISTORY_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * List all saved debates (sorted by date, newest first)
 */
export async function listDebates(): Promise<DebateListItem[]> {
  await ensureHistoryDir();

  try {
    const files = await fs.readdir(HISTORY_DIR);
    const debates: DebateListItem[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      try {
        const filePath = path.join(HISTORY_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");
        const debate: SavedDebate = JSON.parse(content);

        debates.push({
          id: debate.id,
          topic: debate.topic,
          agentNames: debate.agents.map((a) => a.name),
          roundCount: debate.rounds.length,
          consensus: debate.summary?.consensus,
          createdAt: debate.createdAt,
          completedAt: debate.completedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    // Sort by completedAt, newest first
    debates.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    return debates;
  } catch {
    return [];
  }
}

/**
 * Delete a debate
 */
export async function deleteDebate(id: string): Promise<boolean> {
  try {
    const filePath = path.join(HISTORY_DIR, `${id}.json`);
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a branch from an existing debate
 */
export async function createBranch(
  parentId: string,
  branchPoint: { round: number; argumentIndex: number },
  newTopic?: string
): Promise<SavedDebate | null> {
  const parent = await getDebate(parentId);
  if (!parent) return null;

  // Get arguments up to the branch point
  const branchedRounds: DebateRound[] = [];
  for (const round of parent.rounds) {
    if (round.number < branchPoint.round) {
      branchedRounds.push(round);
    } else if (round.number === branchPoint.round) {
      branchedRounds.push({
        ...round,
        arguments: round.arguments.slice(0, branchPoint.argumentIndex),
      });
      break;
    }
  }

  const branchId = `branch-${Date.now()}`;
  const branch: SavedDebate = {
    id: branchId,
    topic: newTopic || `What if: ${parent.topic}`,
    agents: parent.agents,
    rounds: branchedRounds,
    moderatorSteps: [],
    createdAt: new Date().toISOString(),
    completedAt: "", // Not complete yet
    documentName: parent.documentName,
    parentDebateId: parentId,
    branchPoint,
  };

  // Save the branch
  await saveDebate(branch);

  // Update parent to track the branch
  parent.branches = parent.branches || [];
  parent.branches.push(branchId);
  await saveDebate(parent);

  return branch;
}

/**
 * Get branches of a debate
 */
export async function getDebateBranches(id: string): Promise<SavedDebate[]> {
  const debate = await getDebate(id);
  if (!debate || !debate.branches) return [];

  const branches: SavedDebate[] = [];
  for (const branchId of debate.branches) {
    const branch = await getDebate(branchId);
    if (branch) branches.push(branch);
  }

  return branches;
}
