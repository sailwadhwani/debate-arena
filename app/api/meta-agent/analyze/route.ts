/**
 * POST /api/meta-agent/analyze
 *
 * Topic analysis endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import {
  analyzeTopicDirect,
  addMorePerspectives,
  refinePerspectivesWithFeedback,
} from "@/lib/meta-agent";
import type {
  MetaAgentAnalyzeRequest,
  MetaAgentAnalyzeResponse,
  SuggestedPerspective,
} from "@/lib/meta-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = "analyze", topic, context, perspectives, feedback, count } = body;

    switch (action) {
      case "analyze": {
        if (!topic || typeof topic !== "string") {
          return NextResponse.json(
            { error: "Topic is required" },
            { status: 400 }
          );
        }

        const analysis = await analyzeTopicDirect(topic, context);
        const response: MetaAgentAnalyzeResponse = { analysis };
        return NextResponse.json(response);
      }

      case "add_perspectives": {
        if (!topic || !perspectives) {
          return NextResponse.json(
            { error: "Topic and existing perspectives required" },
            { status: 400 }
          );
        }

        const newPerspectives = await addMorePerspectives(
          topic,
          perspectives as SuggestedPerspective[],
          count
        );
        return NextResponse.json({ perspectives: newPerspectives });
      }

      case "refine": {
        if (!topic || !perspectives || !feedback) {
          return NextResponse.json(
            { error: "Topic, perspectives, and feedback required" },
            { status: 400 }
          );
        }

        const refined = await refinePerspectivesWithFeedback(
          topic,
          perspectives as SuggestedPerspective[],
          feedback
        );
        return NextResponse.json({ perspectives: refined });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[API /meta-agent/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze topic" },
      { status: 500 }
    );
  }
}
