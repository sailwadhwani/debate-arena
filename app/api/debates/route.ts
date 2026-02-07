/**
 * API Route: /api/debates
 * List all saved debates
 */

import { NextResponse } from "next/server";
import { listDebates } from "@/lib/storage/debate-history";

export async function GET() {
  try {
    const debates = await listDebates();
    return NextResponse.json({ debates });
  } catch (error) {
    console.error("Failed to list debates:", error);
    return NextResponse.json(
      { error: "Failed to list debates" },
      { status: 500 }
    );
  }
}
