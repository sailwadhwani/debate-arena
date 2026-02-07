/**
 * API Route: /api/settings/tools
 * Manage tool configurations
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const TOOLS_PATH = path.join(process.cwd(), "config", "tools.json");

export interface ToolConfig {
  name: string;
  description: string;
  enabled: boolean;
  requiresApiKey?: string;
  type?: "builtin" | "custom";
  // For custom tools
  inputSchema?: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  // Custom tool can be API-based or template-based
  implementation?: {
    type: "api" | "template";
    endpoint?: string; // For API-based
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    template?: string; // For template-based (returns formatted string)
  };
}

interface ToolsConfig {
  tools: ToolConfig[];
  moderatorTools: ToolConfig[];
}

async function loadToolsConfig(): Promise<ToolsConfig> {
  try {
    const content = await fs.readFile(TOOLS_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { tools: [], moderatorTools: [] };
  }
}

async function saveToolsConfig(config: ToolsConfig): Promise<void> {
  await fs.writeFile(TOOLS_PATH, JSON.stringify(config, null, 2));
}

export async function GET() {
  try {
    const config = await loadToolsConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to load tools config:", error);
    return NextResponse.json({ error: "Failed to load tools" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tool, toolName } = body;

    const config = await loadToolsConfig();

    switch (action) {
      case "add": {
        if (!tool || !tool.name) {
          return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
        }

        // Check for duplicates
        if (config.tools.some((t) => t.name === tool.name)) {
          return NextResponse.json({ error: "Tool with this name already exists" }, { status: 400 });
        }

        const newTool: ToolConfig = {
          ...tool,
          type: "custom",
          enabled: tool.enabled ?? true,
        };

        config.tools.push(newTool);
        await saveToolsConfig(config);

        return NextResponse.json({ success: true, tool: newTool });
      }

      case "update": {
        if (!tool || !tool.name) {
          return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
        }

        const index = config.tools.findIndex((t) => t.name === tool.name);
        if (index === -1) {
          return NextResponse.json({ error: "Tool not found" }, { status: 404 });
        }

        config.tools[index] = { ...config.tools[index], ...tool };
        await saveToolsConfig(config);

        return NextResponse.json({ success: true, tool: config.tools[index] });
      }

      case "delete": {
        if (!toolName) {
          return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
        }

        const index = config.tools.findIndex((t) => t.name === toolName);
        if (index === -1) {
          return NextResponse.json({ error: "Tool not found" }, { status: 404 });
        }

        // Only allow deleting custom tools
        if (config.tools[index].type !== "custom") {
          return NextResponse.json({ error: "Cannot delete built-in tools" }, { status: 400 });
        }

        config.tools.splice(index, 1);
        await saveToolsConfig(config);

        return NextResponse.json({ success: true });
      }

      case "toggle": {
        if (!toolName) {
          return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
        }

        const index = config.tools.findIndex((t) => t.name === toolName);
        if (index === -1) {
          return NextResponse.json({ error: "Tool not found" }, { status: 404 });
        }

        config.tools[index].enabled = !config.tools[index].enabled;
        await saveToolsConfig(config);

        return NextResponse.json({ success: true, enabled: config.tools[index].enabled });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to update tools:", error);
    return NextResponse.json({ error: "Failed to update tools" }, { status: 500 });
  }
}
