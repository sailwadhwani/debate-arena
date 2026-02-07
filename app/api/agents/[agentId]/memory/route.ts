/**
 * API Route: /api/agents/[agentId]/memory
 * Manage agent memory
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadAgentMemory,
  addMemory,
  getRelevantMemories,
  deleteMemory,
  clearAgentMemory,
} from "@/lib/storage/agent-memory";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const topic = searchParams.get("topic");

    if (topic) {
      // Get relevant memories for a topic
      const memories = await getRelevantMemories(agentId, topic, 5);
      return NextResponse.json({ memories });
    }

    // Get all memories
    const memory = await loadAgentMemory(agentId);
    return NextResponse.json(memory);
  } catch (error) {
    console.error("Failed to load agent memory:", error);
    return NextResponse.json({ error: "Failed to load memory" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await context.params;
    const body = await request.json();
    const { action, topic, insight, debateId, round, memoryId } = body;

    switch (action) {
      case "add": {
        if (!topic || !insight || !debateId || typeof round !== "number") {
          return NextResponse.json(
            { error: "topic, insight, debateId, and round are required" },
            { status: 400 }
          );
        }

        const entry = await addMemory(agentId, topic, insight, { debateId, round });
        return NextResponse.json({ success: true, memory: entry });
      }

      case "delete": {
        if (!memoryId) {
          return NextResponse.json({ error: "memoryId is required" }, { status: 400 });
        }

        const success = await deleteMemory(agentId, memoryId);
        if (!success) {
          return NextResponse.json({ error: "Memory not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
      }

      case "clear": {
        await clearAgentMemory(agentId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to update agent memory:", error);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}
