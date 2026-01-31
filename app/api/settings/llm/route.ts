/**
 * GET/PUT /api/settings/llm
 *
 * Manage LLM provider configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "config", "llm.json");

interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  defaultModel: string;
  enabled: boolean;
}

interface LLMConfig {
  providers: {
    claude: ProviderConfig;
    openai: ProviderConfig;
    gemini: ProviderConfig;
    ollama: ProviderConfig;
  };
  defaults: {
    provider: string;
    temperature: number;
    maxTokens: number;
  };
}

// Default config if file doesn't exist
const DEFAULT_CONFIG: LLMConfig = {
  providers: {
    claude: {
      apiKey: "",
      defaultModel: "claude-sonnet-4-20250514",
      enabled: true,
    },
    openai: {
      apiKey: "",
      defaultModel: "gpt-4-turbo",
      enabled: false,
    },
    gemini: {
      apiKey: "",
      defaultModel: "gemini-2.5-flash",
      enabled: false,
    },
    ollama: {
      endpoint: "http://localhost:11434",
      defaultModel: "llama3.2",
      enabled: false,
    },
  },
  defaults: {
    provider: "claude",
    temperature: 0.3,
    maxTokens: 4096,
  },
};

async function loadConfig(): Promise<LLMConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    const fileConfig = JSON.parse(data);

    // Merge with defaults to ensure all fields exist
    return {
      providers: {
        claude: { ...DEFAULT_CONFIG.providers.claude, ...fileConfig.providers?.claude },
        openai: { ...DEFAULT_CONFIG.providers.openai, ...fileConfig.providers?.openai },
        gemini: { ...DEFAULT_CONFIG.providers.gemini, ...fileConfig.providers?.gemini },
        ollama: { ...DEFAULT_CONFIG.providers.ollama, ...fileConfig.providers?.ollama },
      },
      defaults: { ...DEFAULT_CONFIG.defaults, ...fileConfig.defaults },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function saveConfig(config: LLMConfig): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });

  // Don't save API keys directly - they should use env vars
  // But we'll mask them for display purposes
  const safeConfig = {
    providers: {
      claude: {
        apiKey: config.providers.claude.apiKey ? "${ANTHROPIC_API_KEY}" : "",
        defaultModel: config.providers.claude.defaultModel,
        enabled: config.providers.claude.enabled,
      },
      openai: {
        apiKey: config.providers.openai.apiKey ? "${OPENAI_API_KEY}" : "",
        defaultModel: config.providers.openai.defaultModel,
        enabled: config.providers.openai.enabled,
      },
      gemini: {
        apiKey: config.providers.gemini.apiKey ? "${GOOGLE_AI_API_KEY}" : "",
        defaultModel: config.providers.gemini.defaultModel,
        enabled: config.providers.gemini.enabled,
      },
      ollama: {
        endpoint: config.providers.ollama.endpoint,
        defaultModel: config.providers.ollama.defaultModel,
        enabled: config.providers.ollama.enabled,
      },
    },
    defaults: config.defaults,
  };

  await fs.writeFile(CONFIG_PATH, JSON.stringify(safeConfig, null, 2));

  // Also update .env.local with the actual keys if provided
  await updateEnvFile(config);
}

async function updateEnvFile(config: LLMConfig): Promise<void> {
  const envPath = path.join(process.cwd(), ".env.local");
  let envContent = "";

  try {
    envContent = await fs.readFile(envPath, "utf-8");
  } catch {
    // File doesn't exist, start fresh
  }

  const envLines = envContent.split("\n").filter((line) => {
    // Remove existing LLM API key lines
    return !line.startsWith("ANTHROPIC_API_KEY=") &&
           !line.startsWith("OPENAI_API_KEY=") &&
           !line.startsWith("GOOGLE_AI_API_KEY=") &&
           !line.startsWith("OLLAMA_ENDPOINT=");
  });

  // Add new values if provided
  if (config.providers.claude.apiKey && !config.providers.claude.apiKey.startsWith("$")) {
    envLines.push(`ANTHROPIC_API_KEY=${config.providers.claude.apiKey}`);
  }
  if (config.providers.openai.apiKey && !config.providers.openai.apiKey.startsWith("$")) {
    envLines.push(`OPENAI_API_KEY=${config.providers.openai.apiKey}`);
  }
  if (config.providers.gemini.apiKey && !config.providers.gemini.apiKey.startsWith("$")) {
    envLines.push(`GOOGLE_AI_API_KEY=${config.providers.gemini.apiKey}`);
  }
  if (config.providers.ollama.endpoint) {
    envLines.push(`OLLAMA_ENDPOINT=${config.providers.ollama.endpoint}`);
  }

  await fs.writeFile(envPath, envLines.filter(Boolean).join("\n") + "\n");
}

export async function GET() {
  try {
    const config = await loadConfig();

    // Mask API keys for security
    const maskedConfig = {
      ...config,
      providers: {
        claude: {
          ...config.providers.claude,
          apiKey: config.providers.claude.apiKey ? "••••••••" : "",
        },
        openai: {
          ...config.providers.openai,
          apiKey: config.providers.openai.apiKey ? "••••••••" : "",
        },
        gemini: {
          ...config.providers.gemini,
          apiKey: config.providers.gemini.apiKey ? "••••••••" : "",
        },
        ollama: config.providers.ollama,
      },
    };

    // Check for env vars
    if (process.env.ANTHROPIC_API_KEY) {
      maskedConfig.providers.claude.apiKey = "Set via env";
    }
    if (process.env.OPENAI_API_KEY) {
      maskedConfig.providers.openai.apiKey = "Set via env";
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      maskedConfig.providers.gemini.apiKey = "Set via env";
    }

    return NextResponse.json(maskedConfig);
  } catch (error) {
    console.error("[API /settings/llm] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const config: LLMConfig = await request.json();
    await saveConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /settings/llm] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
