import { NextResponse } from "next/server";
import { getLogs, getLogStats, clearLogs } from "@/lib/llm/logging-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const stats = url.searchParams.get("stats") === "true";
    const limit = url.searchParams.get("limit");
    const debateId = url.searchParams.get("debateId");

    if (stats) {
      const logStats = await getLogStats();
      return NextResponse.json(logStats);
    }

    let logs = await getLogs();

    // Apply filters
    if (debateId) {
      logs = logs.filter(l => l.debateId === debateId);
    }

    // Apply limit
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        logs = logs.slice(-limitNum);
      }
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[LLM Logs API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LLM Logs API] Error clearing logs:", error);
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}
