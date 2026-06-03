#!/usr/bin/env bash
# setup.sh — One-shot VPS setup for AgentForge sandboxing
# Run as root or sudo on Ubuntu 22+ / Debian 12+
set -euo pipefail

echo "=== AgentForge VPS Setup ==="

# 1. Install Docker if missing
if ! command -v docker &>/dev/null; then
  echo "[1/6] Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$SUDO_USER" 2>/dev/null || true
else
  echo "[1/6] Docker already installed."
fi

# 2. Create workspace directory with restricted permissions
echo "[2/6] Creating workspace directory…"
mkdir -p /var/agentforge/workspaces
chmod 750 /var/agentforge/workspaces

# 3. Build sandbox image
echo "[3/6] Building sandbox Docker image…"
if ! docker build -t agentforge-sandbox:latest ./sandbox-agent; then
  echo "ERROR: Sandbox image build failed. Check the Dockerfile in ./sandbox-agent"
  exit 1
fi

# 4. Create sandbox network (internal, agents can't reach the internet directly)
echo "[4/6] Creating sandbox Docker network…"
docker network create \
  --driver bridge \
  --internal \
  agentforge-sandbox-net 2>/dev/null || echo "  Network already exists."

# 5. Copy env template if .env doesn't exist
if [ ! -f .env ]; then
  echo "[5/6] Creating .env from template…"
  cp .env.example .env
  # Auto-generate NEXTAUTH_SECRET
  GENERATED_SECRET=$(openssl rand -hex 32)
  sed -i "s/CHANGE_ME_GENERATE_WITH_OPENSSL_RAND_HEX_32/$GENERATED_SECRET/" .env
  echo "  ✓ NEXTAUTH_SECRET auto-generated"
  echo "  ⚠  Edit .env and set DATABASE_URL and API keys before starting."
else
  echo "[5/6] .env already exists, skipping."
fi

# 6. Validate .env has required values
echo "[6/6] Validating configuration…"
if grep -q "CHANGE_ME" .env 2>/dev/null; then
  echo "  ⚠  WARNING: .env still contains placeholder values. Edit it before deploying."
else
  echo "  ✓ Configuration looks good."
fi

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Review and edit .env if needed"
echo "  2. docker compose up -d"
echo "  3. docker compose exec app npx prisma migrate deploy"
echo "  4. Access the app at http://localhost:3000"
