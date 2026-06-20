#!/bin/bash
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

REPO_URL="https://github.com/nick48adm/AgentForge.git"
REPO_BRANCH="unstable"
APP_DIR="/opt/AgentForge"

# Fill these before launch.
GROQ_API_KEY="REPLACE_ME"
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
NVIDIA_NIM_API_KEY=""
SERPAPI_KEY=""
BRAVE_SEARCH_KEY=""

apt-get update
apt-get install -y curl git ca-certificates unzip

# Tiny-instance survival juice.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Bun on host, because the runtime image does not include it.
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Clone repo
rm -rf "$APP_DIR"
git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

# Public URL from instance metadata.
PUBLIC_IP="$(curl -fsS --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
if [ -z "${PUBLIC_IP:-}" ]; then
  PUBLIC_IP="127.0.0.1"
fi
APP_URL="http://${PUBLIC_IP}:3000"

# Host-side env for Prisma push and compose interpolation.
cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://agentforge:agentforge_password@localhost:5433/agentforge
NEXTAUTH_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_APP_URL=$APP_URL
GROQ_API_KEY=$GROQ_API_KEY
OPENAI_API_KEY=$OPENAI_API_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
NVIDIA_NIM_API_KEY=$NVIDIA_NIM_API_KEY
SERPAPI_KEY=$SERPAPI_KEY
BRAVE_SEARCH_KEY=$BRAVE_SEARCH_KEY
SANDBOX_IMAGE=agentforge-sandbox:latest
SANDBOX_NETWORK=agentforge-sandbox-net
EOF

# Start only Postgres first.
docker compose up -d postgres docker-proxy

# Wait for DB to be ready.
until docker compose exec -T postgres pg_isready -U agentforge >/dev/null 2>&1; do
  sleep 3
done

# Install app-side package deps on the host for Prisma CLI.
bun install --frozen-lockfile

# Push schema from host, not inside the app container.
bun run db:push

# Start the app.
docker compose up -d --build app

# Optional, heavy, and not friendly to micro instances:
# docker build -t agentforge-sandbox:latest ./sandbox-agent

docker compose ps
