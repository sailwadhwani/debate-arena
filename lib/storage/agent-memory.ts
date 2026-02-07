/**
 * Agent Memory Storage
 * Stores learned knowledge and insights from past debates
 */

import { promises as fs } from "fs";
import path from "path";

const MEMORY_DIR = path.join(process.cwd(), "data", "agent-memories");

export interface MemoryEntry {
  id: string;
  topic: string;
  insight: string;
  source: {
    debateId: string;
    round: number;
    timestamp: string;
  };
  confidence: number; // 0-1 how confident the agent is in this insight
  useCount: number; // How many times this insight has been used
}

export interface AgentMemory {
  agentId: string;
  memories: MemoryEntry[];
  lastUpdated: string;
  totalDebates: number;
}

/**
 * Ensure the memory directory exists
 */
async function ensureMemoryDir(): Promise<void> {
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

/**
 * Get agent memory file path
 */
function getMemoryPath(agentId: string): string {
  return path.join(MEMORY_DIR, `${agentId}.json`);
}

/**
 * Load agent memory
 */
export async function loadAgentMemory(agentId: string): Promise<AgentMemory> {
  await ensureMemoryDir();

  try {
    const content = await fs.readFile(getMemoryPath(agentId), "utf-8");
    return JSON.parse(content);
  } catch {
    return {
      agentId,
      memories: [],
      lastUpdated: new Date().toISOString(),
      totalDebates: 0,
    };
  }
}

/**
 * Save agent memory
 */
export async function saveAgentMemory(memory: AgentMemory): Promise<void> {
  await ensureMemoryDir();
  memory.lastUpdated = new Date().toISOString();
  await fs.writeFile(getMemoryPath(memory.agentId), JSON.stringify(memory, null, 2));
}

/**
 * Add a memory entry for an agent
 */
export async function addMemory(
  agentId: string,
  topic: string,
  insight: string,
  source: { debateId: string; round: number }
): Promise<MemoryEntry> {
  const memory = await loadAgentMemory(agentId);

  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    topic,
    insight,
    source: {
      ...source,
      timestamp: new Date().toISOString(),
    },
    confidence: 0.7, // Default confidence
    useCount: 0,
  };

  memory.memories.push(entry);

  // Keep only the most recent 100 memories per agent
  if (memory.memories.length > 100) {
    memory.memories = memory.memories.slice(-100);
  }

  await saveAgentMemory(memory);
  return entry;
}

/**
 * Get relevant memories for a topic
 */
export async function getRelevantMemories(
  agentId: string,
  topic: string,
  limit: number = 5
): Promise<MemoryEntry[]> {
  const memory = await loadAgentMemory(agentId);

  // Simple relevance scoring based on topic keyword matching
  const topicWords = topic.toLowerCase().split(/\s+/);

  const scored = memory.memories.map((m) => {
    const memoryText = `${m.topic} ${m.insight}`.toLowerCase();
    let score = 0;

    for (const word of topicWords) {
      if (word.length > 3 && memoryText.includes(word)) {
        score += 1;
      }
    }

    // Boost by confidence and recency
    score *= m.confidence;

    return { memory: m, score };
  });

  // Sort by score and return top N
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.memory);
}

/**
 * Record that a memory was used (increases useCount and confidence)
 */
export async function recordMemoryUse(agentId: string, memoryId: string): Promise<void> {
  const memory = await loadAgentMemory(agentId);
  const entry = memory.memories.find((m) => m.id === memoryId);

  if (entry) {
    entry.useCount++;
    entry.confidence = Math.min(1, entry.confidence + 0.05);
    await saveAgentMemory(memory);
  }
}

/**
 * Update debate count for an agent
 */
export async function recordDebateParticipation(agentId: string): Promise<void> {
  const memory = await loadAgentMemory(agentId);
  memory.totalDebates++;
  await saveAgentMemory(memory);
}

/**
 * Clear all memories for an agent
 */
export async function clearAgentMemory(agentId: string): Promise<void> {
  const memory = await loadAgentMemory(agentId);
  memory.memories = [];
  await saveAgentMemory(memory);
}

/**
 * Delete a specific memory
 */
export async function deleteMemory(agentId: string, memoryId: string): Promise<boolean> {
  const memory = await loadAgentMemory(agentId);
  const index = memory.memories.findIndex((m) => m.id === memoryId);

  if (index === -1) return false;

  memory.memories.splice(index, 1);
  await saveAgentMemory(memory);
  return true;
}
