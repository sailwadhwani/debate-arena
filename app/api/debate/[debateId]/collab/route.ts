/**
 * API Route: /api/debate/[debateId]/collab
 * Collaboration features - reactions, viewer count, share links
 */

import { NextRequest, NextResponse } from "next/server";
import { debateStateManager } from "@/lib/state/debate-state";
import { debateEventEmitter } from "@/lib/events/emitter";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await context.params;
  const state = debateStateManager.get(debateId);

  if (!state) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  const shareCode = debateStateManager.generateShareCode(debateId);
  const viewerCount = debateStateManager.getViewerCount(debateId);
  const reactions = Object.fromEntries(debateStateManager.getAllReactions(debateId));

  return NextResponse.json({
    shareCode,
    shareUrl: `/watch/${shareCode}`,
    viewerCount,
    reactions,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await context.params;
  const body = await request.json();
  const { action, argumentId, reactionType, viewerId } = body;

  const state = debateStateManager.get(debateId);
  if (!state) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  switch (action) {
    case "join": {
      const count = debateStateManager.addViewer(debateId, viewerId);
      debateEventEmitter.emit(debateId, "viewer_joined" as any, { viewerCount: count });
      return NextResponse.json({ viewerCount: count });
    }

    case "leave": {
      const count = debateStateManager.removeViewer(debateId, viewerId);
      debateEventEmitter.emit(debateId, "viewer_left" as any, { viewerCount: count });
      return NextResponse.json({ viewerCount: count });
    }

    case "react": {
      if (!argumentId || !reactionType || !viewerId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const reactions = debateStateManager.addReaction(debateId, argumentId, viewerId, reactionType);
      const counts = debateStateManager.getReactions(debateId, argumentId);

      debateEventEmitter.emit(debateId, "reaction_added" as any, {
        argumentId,
        reactions: counts,
      });

      return NextResponse.json({ reactions: counts });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
