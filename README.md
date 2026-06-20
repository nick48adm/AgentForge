# AgentForge

**Build, deploy, and chat with AI agents — powered by [Hermes Agent](https://github.com/NousResearch/hermes-agent) (NousResearch).**

AgentForge is a self-hosted platform that lets you create AI agents with custom personas, knowledge bases, and tools — then chat with them like ChatGPT, connect them to Telegram, or expose them via embeddable widgets. Each published agent runs in its own isolated Docker container with a full **Hermes Agent** instance inside: skills, memory, a self-improving agentic loop, and real tool use.

## What it does

- **Create agents** — give each agent a name, system prompt, model, temperature, and tools
- **Chat with agents** — real-time chat in the browser (draft preview or published sandbox)
- **Hermes inside every sandbox** — published agents run the full Hermes Agent loop: persistent memory, skill creation, multi-step tool use
- **Telegram integration** — connect any agent to a Telegram bot with one click
- **Knowledge bases** — upload text documents each agent can reference
- **Multi-provider model support** — Groq (free), OpenAI, Anthropic, NVIDIA NIM — switch per agent, no lock-in

## Tech stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, Prisma ORM, PostgreSQL
- **Agent sandbox**: Docker container per agent running Node.js bridge + Hermes Agent (Python)
- **Auth**: NextAuth.js (credentials)

## Quick start

### Requirements

- Docker + Docker Compose
- Node.js 20+ or Bun
- At least one LLM API key (Groq is free: https://console.groq.com)

### 1. Clone and configure

```bash
git clone https://github.com/nick48adm/AgentForge
cd AgentForge
cp .env.example .env
# Edit .env — fill in your API keys and generate NEXTAUTH_SECRET
openssl rand -hex 32   # use the output as NEXTAUTH_SECRET
```

### 2. Start the database

```bash
docker compose up -d db
```

### 3. Run migrations & start the app

```bash
bun install            # or: npm install
bun run db:push        # or: npx prisma db push
bun run dev            # or: npm run dev
```

Open http://localhost:3000

### 4. Build the sandbox image (needed before deploying agents)

```bash
docker build -t agentforge-sandbox:latest ./sandbox-agent
```

This builds a container image with **Hermes Agent** pre-installed. Each agent you publish gets its own instance of this image running in isolation.

## Supported models

| Provider | Example models | Key needed |
|---|---|---|
| **Groq** (free) | Llama 3.3 70B, Mixtral 8x7B, Gemma 2 | `GROQ_API_KEY` |
| **OpenAI** | GPT-4o, GPT-4o Mini, o4 Mini | `OPENAI_API_KEY` |
| **Anthropic** | Claude Sonnet 4.5, Claude Opus 4.5 | `ANTHROPIC_API_KEY` |
| **NVIDIA NIM** | Kimi 2.6, DeepSeek V4 Pro, GLM 5.1 | `NVIDIA_NIM_API_KEY` |

## How Hermes runs inside the sandbox

When you click **Publish**, AgentForge:

1. Stops any existing container for that agent
2. Starts a new Docker container from `agentforge-sandbox:latest`
3. The container runs a Node.js HTTP bridge + a Hermes Agent process
4. Hermes is configured with your agent's system prompt (SOUL.md), model, and tools
5. Each chat message is forwarded to the Hermes process — which uses its full agentic loop (multi-step tool calls, memory, skills)
6. The container persists conversation history and skills in `/workspace`

Draft agents (not yet published) use a direct LLM API call without the Hermes loop.

## Environment variables

See `.env.example` for the full list. Required:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — random 32-byte hex string
- `NEXT_PUBLIC_APP_URL` — your app's public URL (for webhooks)
- At least one of: `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NVIDIA_NIM_API_KEY`

## Production deploy (VPS)

```bash
# Build the app
bun run build

# Build the sandbox image
docker build -t agentforge-sandbox:latest ./sandbox-agent

# Start everything
docker compose up -d
```

The included `docker-compose.yml` runs the app + PostgreSQL. Caddy (reverse proxy with TLS) config is in `Caddyfile`.

## License

MIT
