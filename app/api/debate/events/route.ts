/**
 * GET /api/debate/events?debateId=xxx
 *
 * SSE endpoint for debate events
 */

import { NextRequest } from "next/server";
import { createSSEStream, debateEventEmitter } from "@/lib/events/emitter";
import { debateStateManager } from "@/lib/state/debate-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const debateId = request.nextUrl.searchParams.get("debateId");

  if (!debateId) {
    return new Response("debateId is required", { status: 400 });
  }

  // Check if debate exists
  const state = debateStateManager.get(debateId);
  if (!state) {
    return new Response("Debate not found", { status: 404 });
  }

  // Create SSE stream
  const stream = createSSEStream(debateId);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
