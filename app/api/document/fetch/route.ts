/**
 * POST /api/document/fetch
 *
 * Fetch and extract content from URL
 */

import { NextRequest, NextResponse } from "next/server";
import { extractFromUrl } from "@/lib/document/extractor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Extract content from URL
    const result = await extractFromUrl(url);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      content: result.content,
      name: result.name,
      source: "url",
      wordCount: result.wordCount,
    });
  } catch (error) {
    console.error("[API /document/fetch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch URL" },
      { status: 500 }
    );
  }
}
