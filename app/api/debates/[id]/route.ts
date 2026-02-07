/**
 * API Route: /api/debates/[id]
 * Get or delete a specific debate
 */

import { NextRequest, NextResponse } from "next/server";
import { getDebate, deleteDebate } from "@/lib/storage/debate-history";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const debate = await getDebate(id);

    if (!debate) {
      return NextResponse.json(
        { error: "Debate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ debate });
  } catch (error) {
    console.error("Failed to get debate:", error);
    return NextResponse.json(
      { error: "Failed to get debate" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const success = await deleteDebate(id);

    if (!success) {
      return NextResponse.json(
        { error: "Debate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete debate:", error);
    return NextResponse.json(
      { error: "Failed to delete debate" },
      { status: 500 }
    );
  }
}
