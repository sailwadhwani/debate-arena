/**
 * GET /api/debate/[debateId]
 * POST /api/debate/[debateId] - Actions: pause, resume
 *
 * Get debate state and control debate flow
 */

import { NextRequest, NextResponse } from "next/server";
import { debateStateManager } from "@/lib/state/debate-state";
import { debateEventEmitter } from "@/lib/events/emitter";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;

  const state = debateStateManager.get(debateId);

  if (!state) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  // Don't send full document content in state response
  const { documentContent, ...stateWithoutContent } = state;

  return NextResponse.json({
    ...stateWithoutContent,
    hasDocument: !!documentContent,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    const state = debateStateManager.get(debateId);

    if (!state) {
      return NextResponse.json({ error: "Debate not found" }, { status: 404 });
    }

    if (action === "pause") {
      if (state.status !== "debating") {
        return NextResponse.json(
          { error: "Can only pause an active debate" },
          { status: 400 }
        );
      }

      debateStateManager.pause(debateId);

      // Emit pause event
      debateEventEmitter.emit(debateId, "debate_paused" as any, {
        debateId,
        status: "paused",
      });

      return NextResponse.json({
        success: true,
        status: "paused",
        message: "Debate paused",
      });
    }

    if (action === "resume") {
      if (state.status !== "paused") {
        return NextResponse.json(
          { error: "Can only resume a paused debate" },
          { status: 400 }
        );
      }

      debateStateManager.resume(debateId);

      // Emit resume event
      debateEventEmitter.emit(debateId, "debate_resumed" as any, {
        debateId,
        status: "debating",
      });

      return NextResponse.json({
        success: true,
        status: "debating",
        message: "Debate resumed",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[API /debate/[debateId]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process action" },
      { status: 500 }
    );
  }
}
