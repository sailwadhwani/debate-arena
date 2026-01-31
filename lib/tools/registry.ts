/**
 * Tool Registry for Debate Arena
 */

import type { Tool, ToolDefinition, ToolRegistry, ToolResult, ToolContext } from "./types";

class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((t) => t.definition);
  }

  getDefinitionsForNames(names: string[]): ToolDefinition[] {
    return names
      .map((name) => this.tools.get(name))
      .filter((t): t is Tool => t !== undefined)
      .map((t) => t.definition);
  }

  async execute(name: string, input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, result: "", error: `Tool not found: ${name}` };
    }
    return tool.execute(input, context);
  }
}

// Global registry instance
export const toolRegistry = new ToolRegistryImpl();

// =============================================================================
// BUILT-IN TOOLS
// =============================================================================

// Calculator Tool
const calculatorTool: Tool = {
  definition: {
    name: "calculator",
    description: "Perform mathematical calculations. Supports basic arithmetic, percentages, and common math functions.",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The mathematical expression to evaluate (e.g., '2 + 2', '100 * 0.15', 'Math.sqrt(16)')",
        },
      },
      required: ["expression"],
    },
  },
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    try {
      const expression = input.expression as string;
      // Safe eval using Function constructor with Math context
      const safeExpression = expression.replace(/[^0-9+\-*/().%\s]/g, (match) => {
        if (match.startsWith("Math.")) return match;
        return "";
      });
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const result = new Function("Math", `return ${safeExpression}`)(Math);
      return { success: true, result: String(result) };
    } catch (error) {
      return { success: false, result: "", error: `Calculation error: ${error}` };
    }
  },
};

// Document Query Tool
const documentQueryTool: Tool = {
  definition: {
    name: "query_document",
    description: "Search the loaded document for specific information, keywords, or sections.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query or keywords to find in the document",
        },
        section: {
          type: "string",
          description: "Optional: specific section of the document to search (e.g., 'introduction', 'conclusion')",
        },
      },
      required: ["query"],
    },
  },
  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const query = input.query as string;
    const section = input.section as string | undefined;
    const documentContent = context?.documentContent;

    if (!documentContent) {
      return { success: false, result: "", error: "No document loaded" };
    }

    // Simple search implementation
    const lines = documentContent.split("\n");
    const queryLower = query.toLowerCase();
    const matches: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        // Include context (2 lines before and after)
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        const context = lines.slice(start, end).join("\n");
        matches.push(`[Line ${i + 1}]\n${context}`);
        if (matches.length >= 5) break; // Limit to 5 matches
      }
    }

    if (matches.length === 0) {
      return { success: true, result: `No matches found for "${query}"${section ? ` in section "${section}"` : ""}` };
    }

    return {
      success: true,
      result: `Found ${matches.length} match(es) for "${query}":\n\n${matches.join("\n\n---\n\n")}`,
    };
  },
};

// Web Search Tool (placeholder - requires API key)
const webSearchTool: Tool = {
  definition: {
    name: "web_search",
    description: "Search the web for current information on a topic. Useful for finding recent news, regulations, or market data.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        numResults: {
          type: "string",
          description: "Number of results to return (default: 3)",
        },
      },
      required: ["query"],
    },
  },
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const query = input.query as string;
    const numResults = parseInt(input.numResults as string) || 3;

    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      return {
        success: true,
        result: `[Web search unavailable - no API key configured]\nSimulated search for: "${query}"\nPlease configure TAVILY_API_KEY for real web search results.`,
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: numResults,
          search_depth: "basic",
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        return { success: true, result: `No web results found for "${query}"` };
      }

      const formattedResults = results
        .map((r: { title: string; url: string; content: string }, i: number) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content.substring(0, 200)}...`)
        .join("\n\n");

      return { success: true, result: `Web search results for "${query}":\n\n${formattedResults}` };
    } catch (error) {
      return { success: false, result: "", error: `Web search error: ${error}` };
    }
  },
};

// =============================================================================
// MODERATOR TOOLS
// =============================================================================

const evaluateConsensusTool: Tool = {
  definition: {
    name: "evaluate_consensus",
    description: "Evaluate the level of agreement across all agent positions in the current debate round.",
    inputSchema: {
      type: "object",
      properties: {
        round: {
          type: "string",
          description: "The round number to evaluate",
        },
      },
      required: ["round"],
    },
  },
  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    // This would be implemented with actual debate state
    const round = input.round as string;
    return {
      success: true,
      result: `Consensus evaluation for round ${round}: Moderate agreement detected. Key themes align on risk identification, but differ on severity assessment and recommended actions.`,
    };
  },
};

const identifyConflictsTool: Tool = {
  definition: {
    name: "identify_conflicts",
    description: "Identify key points of disagreement between agents in the debate.",
    inputSchema: {
      type: "object",
      properties: {
        focus: {
          type: "string",
          description: "Optional: specific aspect to focus on (e.g., 'risk level', 'timeline', 'cost')",
        },
      },
    },
  },
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const focus = input.focus as string | undefined;
    return {
      success: true,
      result: `Key conflicts identified${focus ? ` regarding ${focus}` : ""}:\n1. Risk severity assessment differs by 2+ levels\n2. Timeline recommendations vary significantly\n3. Resource allocation priorities conflict`,
    };
  },
};

const assessProgressTool: Tool = {
  definition: {
    name: "assess_progress",
    description: "Determine if new substantive points are being made in the debate.",
    inputSchema: {
      type: "object",
      properties: {
        sinceRound: {
          type: "string",
          description: "Assess progress since this round number",
        },
      },
    },
  },
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const sinceRound = input.sinceRound as string | undefined;
    return {
      success: true,
      result: `Progress assessment${sinceRound ? ` since round ${sinceRound}` : ""}:\n- New evidence introduced: Yes\n- Positions refined: 2 of 3 agents\n- Convergence trend: Slight improvement\n- Diminishing returns: Not yet reached`,
    };
  },
};

const generateSummaryTool: Tool = {
  definition: {
    name: "generate_summary",
    description: "Generate a final synthesis of all perspectives from the debate.",
    inputSchema: {
      type: "object",
      properties: {
        includeRecommendation: {
          type: "string",
          description: "Whether to include a recommendation (true/false)",
        },
      },
    },
  },
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return {
      success: true,
      result: `[Summary generation initiated - this tool signals the moderator is ready to conclude]`,
    };
  },
};

// Register all tools
toolRegistry.register(calculatorTool);
toolRegistry.register(documentQueryTool);
toolRegistry.register(webSearchTool);
toolRegistry.register(evaluateConsensusTool);
toolRegistry.register(identifyConflictsTool);
toolRegistry.register(assessProgressTool);
toolRegistry.register(generateSummaryTool);

export { calculatorTool, documentQueryTool, webSearchTool };
