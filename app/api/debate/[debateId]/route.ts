/**
 * GET /api/debate/[debateId]
 *
 * Get debate state
 */

import { NextRequest, NextResponse } from "next/server";
import { debateStateManager } from "@/lib/state/debate-state";

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
