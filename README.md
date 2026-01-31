# Debate Arena

A multi-agent AI debate platform featuring configurable AI personas that debate from their unique perspectives, orchestrated by a ReAct-based moderator with dual 2D/3D visualization.

## Features

- **Multi-Agent Debate**: Multiple AI personas (Compliance, Business, PM, Technical) debate topics from their unique perspectives
- **Document Input**: Upload PDFs, fetch URLs, or paste text for agents to analyze
- **ReAct Framework**: Agents use reasoning + acting pattern with extensible tools
- **Dual Visualization**:
  - **2D View**: Cards, timeline, vote distribution
  - **3D View**: Wireframe humanoids with Three.js, speech bubbles, glow effects
- **Live Moderator**: Shows thinking/acting/observing workflow in real-time
- **Configurable Agents**: Rich UI for editing personas, system prompts, and tool access
- **Multi-Provider LLM**: Supports Claude, OpenAI, Gemini, and Ollama

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and add your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local` with at least one LLM API key:

```bash
# Required: At least one LLM provider
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Additional providers
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...

# Optional: Web search capability
TAVILY_API_KEY=tvly-...
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the debate arena.

## Architecture

```
app/
├── debate/         # Main debate arena page
├── agents/         # Agent configuration page
└── api/
    ├── debate/     # Debate start/events endpoints
    ├── document/   # PDF upload, URL fetch
    └── agents/     # Agent config CRUD

lib/
├── agents/         # DebateAgent, ModeratorAgent
├── llm/            # Multi-provider LLM client
├── tools/          # Tool registry (web_search, calculator, query_document)
├── document/       # PDF/URL extraction
├── events/         # SSE event emitter
├── state/          # In-memory debate state
└── config/         # JSON config loader

components/
├── arena/          # Main arena, inputs, controls
├── visualization-2d/  # Cards, timeline, vote visualization
├── visualization-3d/  # Three.js scene, PersonaMesh, speech bubbles
├── moderator/      # ReAct step visualization
└── ui/             # Shared UI components

config/
├── agents.json     # Agent personas
├── llm.json        # LLM provider settings
└── tools.json      # Tool definitions
```

## Configuration

### Agent Configuration

Edit `config/agents.json` or use the web UI at `/agents`:

```json
{
  "agents": [
    {
      "id": "compliance-counsel",
      "name": "Compliance Counsel",
      "role": "compliance",
      "avatar": "shield",
      "color": "#ef4444",
      "systemPrompt": "You are a compliance expert...",
      "bias": "cautious",
      "tools": ["web_search", "query_document"]
    }
  ],
  "moderator": {
    "id": "moderator",
    "name": "Debate Moderator",
    "systemPrompt": "You are an impartial moderator...",
    "maxRounds": 5
  }
}
```

### LLM Configuration

Edit `config/llm.json`:

```json
{
  "providers": {
    "claude": { "apiKeyEnv": "ANTHROPIC_API_KEY", "defaultModel": "claude-sonnet-4-20250514" },
    "openai": { "apiKeyEnv": "OPENAI_API_KEY", "defaultModel": "gpt-4-turbo" }
  },
  "defaults": { "provider": "claude", "temperature": 0.3 }
}
```

## Tools

Built-in tools available to agents:

- **web_search**: Search the web for current information (requires Tavily API key)
- **calculator**: Perform mathematical calculations
- **query_document**: Search the loaded document for specific information

Moderator-specific tools:

- **evaluate_consensus**: Check agreement level across agents
- **identify_conflicts**: Find key points of disagreement
- **assess_progress**: Determine if new points are being made
- **generate_summary**: Create final synthesis

## Debate Flow

1. **Setup**: Load document (optional), enter debate task, select agents
2. **Start**: Agents provide initial arguments in round 1
3. **Debate**: For each round:
   - Each agent provides their perspective (using ReAct with tools)
   - Moderator evaluates and decides to continue or conclude
4. **Conclude**: Moderator generates final summary with recommendations

## Tech Stack

- **Framework**: Next.js with App Router
- **UI**: React, Tailwind CSS, Framer Motion
- **3D**: Three.js via @react-three/fiber, drei, postprocessing
- **LLM**: Multi-provider (Claude, OpenAI, Gemini, Ollama)
- **PDF**: unpdf for server-side extraction
- **Streaming**: Server-Sent Events (SSE)

## License

MIT
