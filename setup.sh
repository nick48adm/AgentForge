#!/usr/bin/env bash
# setup.sh — One-shot VPS setup for AgentForge sandboxing
# Run as root or sudo on Ubuntu 22+ / Debian 12+
set -euo pipefail

echo "=== AgentForge VPS Setup ==="

# 1. Install Docker if missing
if ! command -v docker &>/dev/null; then
  echo "[1/5] Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$SUDO_USER" 2>/dev/null || true
else
  echo "[1/5] Docker already installed."
fi

# 2. Create workspace directory
echo "[2/5] Creating workspace directory…"
mkdir -p /var/agentforge/workspaces
chmod 755 /var/agentforge/workspaces

# 3. Build sandbox image
echo "[3/5] Building sandbox Docker image…"
docker build -t agentforge-sandbox:latest ./sandbox-agent

# 4. Create sandbox network (internal, agents can't reach the internet directly)
echo "[4/5] Creating sandbox Docker network…"
docker network create \
  --driver bridge \
  --internal \
  agentforge-sandbox-net 2>/dev/null || echo "  Network already exists."

# 5. Copy env template
if [ ! -f .env ]; then
  echo "[5/5] Creating .env from template…"
  cp .env.example .env
  echo "  ⚠  Edit .env and set NEXTAUTH_SECRET, DATABASE_URL, and API keys before starting."
else
  echo "[5/5] .env already exists, skipping."
fi

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Edit .env"
echo "  2. docker compose up -d"
echo "  3. docker compose exec app bun run db:push"
