/**
 * API Route: /api/debates/[id]/branch
 * Create a branch from an existing debate
 */

import { NextRequest, NextResponse } from "next/server";
import { createBranch, getDebateBranches } from "@/lib/storage/debate-history";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const branches = await getDebateBranches(id);
    return NextResponse.json({ branches });
  } catch (error) {
    console.error("Failed to get branches:", error);
    return NextResponse.json({ error: "Failed to get branches" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { round, argumentIndex, newTopic } = body;

    if (typeof round !== "number" || typeof argumentIndex !== "number") {
      return NextResponse.json(
        { error: "round and argumentIndex are required" },
        { status: 400 }
      );
    }

    const branch = await createBranch(id, { round, argumentIndex }, newTopic);

    if (!branch) {
      return NextResponse.json(
        { error: "Parent debate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      branch,
      startUrl: `/debate?branch=${branch.id}`,
    });
  } catch (error) {
    console.error("Failed to create branch:", error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
