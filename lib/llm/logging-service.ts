/**
 * LLM Call Logging Service
 * Fire-and-forget logging of all LLM API calls with JSON file storage
 */

import { promises as fs } from "fs";
import path from "path";

export interface LLMLogEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  durationMs: number;
  systemPrompt?: string;
  userPrompt: string;
  response?: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  success: boolean;
  errorMessage?: string;
  purpose?: string; // e.g., "opening", "rebuttal", "moderator", "summary"
  agentId?: string;
  agentName?: string;
  toolsAvailable?: string[];
  toolsCalled?: string[];
  debateId?: string;
  round?: number;
}

const LOG_FILE_PATH = path.join(process.cwd(), "data", "llm-logs.json");
const MAX_LOG_ENTRIES = 1000; // Keep last 1000 entries

// In-memory cache for logs
let logsCache: LLMLogEntry[] | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 5000; // 5 seconds cache

async function ensureDataDir() {
  const dataDir = path.dirname(LOG_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function loadLogs(): Promise<LLMLogEntry[]> {
  const now = Date.now();

  // Return cached logs if still valid
  if (logsCache && now - lastLoadTime < CACHE_TTL) {
    return logsCache;
  }

  try {
    await ensureDataDir();
    const data = await fs.readFile(LOG_FILE_PATH, "utf-8");
    logsCache = JSON.parse(data);
    lastLoadTime = now;
    return logsCache || [];
  } catch {
    // File doesn't exist or is invalid - start fresh
    logsCache = [];
    lastLoadTime = now;
    return [];
  }
}

async function saveLogs(logs: LLMLogEntry[]) {
  await ensureDataDir();

  // Keep only the last MAX_LOG_ENTRIES
  const trimmedLogs = logs.slice(-MAX_LOG_ENTRIES);

  await fs.writeFile(LOG_FILE_PATH, JSON.stringify(trimmedLogs, null, 2));
  logsCache = trimmedLogs;
  lastLoadTime = Date.now();
}

/**
 * Log an LLM API call - fire and forget, never throws
 */
export async function logLLMCall(entry: Omit<LLMLogEntry, "id" | "timestamp">): Promise<void> {
  try {
    const fullEntry: LLMLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    const logs = await loadLogs();
    logs.push(fullEntry);
    await saveLogs(logs);
  } catch (error) {
    // Fire and forget - log errors to console but don't propagate
    console.error("[LLM Logging] Failed to log entry:", error);
  }
}

/**
 * Get all logs
 */
export async function getLogs(): Promise<LLMLogEntry[]> {
  return loadLogs();
}

/**
 * Get logs filtered by criteria
 */
export async function getFilteredLogs(filters: {
  provider?: string;
  debateId?: string;
  agentId?: string;
  purpose?: string;
  since?: Date;
  limit?: number;
}): Promise<LLMLogEntry[]> {
  let logs = await loadLogs();

  if (filters.provider) {
    logs = logs.filter(l => l.provider === filters.provider);
  }
  if (filters.debateId) {
    logs = logs.filter(l => l.debateId === filters.debateId);
  }
  if (filters.agentId) {
    logs = logs.filter(l => l.agentId === filters.agentId);
  }
  if (filters.purpose) {
    logs = logs.filter(l => l.purpose === filters.purpose);
  }
  if (filters.since) {
    const sinceTime = filters.since.getTime();
    logs = logs.filter(l => new Date(l.timestamp).getTime() >= sinceTime);
  }
  if (filters.limit) {
    logs = logs.slice(-filters.limit);
  }

  return logs;
}

/**
 * Get aggregate stats
 */
export async function getLogStats(): Promise<{
  totalCalls: number;
  totalTokens: number;
  avgDuration: number;
  successRate: number;
  byProvider: Record<string, { calls: number; tokens: number }>;
  byPurpose: Record<string, { calls: number; tokens: number }>;
}> {
  const logs = await loadLogs();

  const stats = {
    totalCalls: logs.length,
    totalTokens: 0,
    avgDuration: 0,
    successRate: 0,
    byProvider: {} as Record<string, { calls: number; tokens: number }>,
    byPurpose: {} as Record<string, { calls: number; tokens: number }>,
  };

  if (logs.length === 0) return stats;

  let totalDuration = 0;
  let successCount = 0;

  for (const log of logs) {
    stats.totalTokens += log.tokensUsed.total;
    totalDuration += log.durationMs;
    if (log.success) successCount++;

    // By provider
    if (!stats.byProvider[log.provider]) {
      stats.byProvider[log.provider] = { calls: 0, tokens: 0 };
    }
    stats.byProvider[log.provider].calls++;
    stats.byProvider[log.provider].tokens += log.tokensUsed.total;

    // By purpose
    const purpose = log.purpose || "unknown";
    if (!stats.byPurpose[purpose]) {
      stats.byPurpose[purpose] = { calls: 0, tokens: 0 };
    }
    stats.byPurpose[purpose].calls++;
    stats.byPurpose[purpose].tokens += log.tokensUsed.total;
  }

  stats.avgDuration = Math.round(totalDuration / logs.length);
  stats.successRate = Math.round((successCount / logs.length) * 100) / 100;

  return stats;
}

/**
 * Clear all logs
 */
export async function clearLogs(): Promise<void> {
  await ensureDataDir();
  await saveLogs([]);
}

/**
 * Helper to create a logging wrapper for LLM calls
 */
export function createLoggingContext(baseContext: {
  debateId?: string;
  agentId?: string;
  agentName?: string;
  purpose?: string;
}) {
  return {
    ...baseContext,
    async wrapCall<T>(
      provider: string,
      model: string,
      systemPrompt: string | undefined,
      userPrompt: string,
      toolsAvailable: string[] | undefined,
      callFn: () => Promise<{ result: T; tokensUsed: { input: number; output: number; total: number }; response?: string; toolsCalled?: string[] }>
    ): Promise<T> {
      const startTime = Date.now();
      let success = true;
      let errorMessage: string | undefined;
      let response: string | undefined;
      let tokensUsed = { input: 0, output: 0, total: 0 };
      let toolsCalled: string[] | undefined;
      let result: T;

      try {
        const callResult = await callFn();
        result = callResult.result;
        tokensUsed = callResult.tokensUsed;
        response = callResult.response;
        toolsCalled = callResult.toolsCalled;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        const durationMs = Date.now() - startTime;

        // Fire and forget the logging
        logLLMCall({
          provider,
          model,
          durationMs,
          systemPrompt,
          userPrompt,
          response,
          tokensUsed,
          success,
          errorMessage,
          purpose: baseContext.purpose,
          agentId: baseContext.agentId,
          agentName: baseContext.agentName,
          debateId: baseContext.debateId,
          toolsAvailable,
          toolsCalled,
        }).catch(() => {}); // Ensure fire-and-forget
      }

      return result!;
    },
  };
}
