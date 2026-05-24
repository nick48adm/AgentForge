# AgentForge

Multi-tenant AI Agent Builder Platform with **true per-agent Docker sandboxing**.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│                    VPS (single)                │
│                                                │
│  ┌──────────────┐    ┌───────────────────────┐ │
│  │  Next.js App │    │  Docker Sandbox Net   │ │
│  │  (port 3000) │───▶│  (agentforge-sandbox) │ │
│  └──────────────┘    │                       │ │
│         │            │  ┌─────────────────┐  │ │
│  ┌──────┴──────┐     │  │  af-agent-AAA   │  │ │
│  │  PostgreSQL │     │  │  256MB / 0.5CPU │  │ │
│  │  (port 5433)│     │  │  /workspace:rw  │  │ │
│  └─────────────┘     │  └─────────────────┘  │ │
│                       │  ┌─────────────────┐  │ │
│                       │  │  af-agent-BBB   │  │ │
│                       │  │  256MB / 0.5CPU │  │ │
│                       │  │  /workspace:rw  │  │ │
│                       │  └─────────────────┘  │ │
│                       └───────────────────────┘ │
└────────────────────────────────────────────────┘
```

Each deployed agent runs in its own Docker container with:
- **Isolated filesystem** — read-only rootfs; only `/workspace` is writable (agent-private data)
- **Resource limits** — 256 MB RAM, 0.5 CPU cores, 100 max processes
- **Network isolation** — containers on an `--internal` Docker network (no direct internet access; LLM calls go through the app or via env-injected API keys)
- **Non-root user** — `sandboxuser` with dropped capabilities
- **Per-agent workspace** — `/var/agentforge/workspaces/<agentId>` mounted as `/workspace`

---

## Quick Start (VPS)

### Prerequisites
- Ubuntu 22.04+ or Debian 12+
- Docker ≥ 24
- 2 GB+ RAM recommended

### 1. Clone & configure
```bash
git clone https://github.com/nick48adm/AgentForge
cd AgentForge
cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET, NEXT_PUBLIC_APP_URL, and API keys
nano .env
```

### 2. Run setup (builds sandbox image + creates Docker network)
```bash
chmod +x setup.sh
sudo ./setup.sh
```

### 3. Start services
```bash
docker compose up -d
docker compose exec app bun run db:push
```

App is now live at `http://localhost:3000` (or your domain).

---

## Development (local)

```bash
# Start Postgres
docker compose up postgres -d

# Install deps
bun install

# Push DB schema
bun run db:push

# Build sandbox image (needed for deploy to work locally)
docker build -t agentforge-sandbox:latest ./sandbox-agent

# Create sandbox network
docker network create --driver bridge --internal agentforge-sandbox-net

# Start dev server
bun dev
```

---

## Sandbox Container Details

| Property | Value |
|----------|-------|
| Base image | `node:22-alpine` |
| User | `sandboxuser` (non-root) |
| Memory limit | 256 MB |
| CPU limit | 0.5 cores |
| PID limit | 100 |
| Root filesystem | Read-only |
| Writable paths | `/workspace` (agent data), `/tmp` (64 MB, noexec) |
| Capabilities | Only `NET_BIND_SERVICE` |
| Network | Docker-internal (`agentforge-sandbox-net`) |
| Health check | `GET /_health` every 15s |

---

## Sandbox HTTP API (internal only)

These endpoints are reachable only from within the Docker network:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | Process a message through the agent |
| GET | `/_health` | Health check |
| PATCH | `/_admin/reconfigure` | Hot-reload agent config without restart |

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user (password hashed with PBKDF2) |
| POST | `/api/auth/login` | Login |
| GET | `/api/agents` | List user's agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/[id]` | Get agent |
| PATCH | `/api/agents/[id]` | Update agent |
| DELETE | `/api/agents/[id]` | Delete agent |
| POST | `/api/agents/[id]/deploy` | Deploy → starts real Docker container |
| GET | `/api/agents/[id]/deploy?jobId=` | Poll deploy job + live logs |
| POST | `/api/agents/[id]/stop` | Stop → removes Docker container |
| POST | `/api/chat` | Chat (proxies to sandbox or direct LLM) |
| POST | `/api/telegram/webhook/[agentId]` | Per-agent Telegram webhook |

---

## Bugs Fixed

1. **Fake deploy** — `simulateDeploy` was pure `setTimeout` with no real containerisation. Replaced with real Docker lifecycle management.
2. **Shared LLM process** — all agents shared one Node.js process. Now each deployed agent runs in isolation.
3. **Plaintext passwords** — passwords stored and compared in plaintext. Now hashed with PBKDF2-SHA256 (100k iterations) with automatic migration on next login.
4. **Telegram multi-agent routing bug** — webhook always routed to `connections[0]`, so only one bot could receive messages. Fixed with per-agent webhook URLs `/api/telegram/webhook/[agentId]`.
5. **No resource limits** — one agent could starve all others. Docker resource limits now enforced.
6. **No filesystem isolation** — agents could read each other's data. Each container now has an isolated `/workspace`.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret (32+ random bytes) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL (for Telegram webhooks) |
| `GROQ_API_KEY` | one of | Groq API key (https://console.groq.com) |
| `NVIDIA_NIM_API_KEY` | one of | NVIDIA NIM API key (https://build.nvidia.com) |
| `OPENAI_API_KEY` | ❌ | OpenAI API key (optional fallback) |
| `SANDBOX_IMAGE` | ❌ | Default: `agentforge-sandbox:latest` |
| `SANDBOX_NETWORK` | ❌ | Default: `agentforge-sandbox-net` |
| `SANDBOX_WORKSPACE_ROOT` | ❌ | Default: `/var/agentforge/workspaces` |
