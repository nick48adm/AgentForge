FROM python:3.11-slim

# ── System dependencies ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git nodejs npm ripgrep ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ── Install hermes-agent (NousResearch) ───────────────────────────────────────
# Install uv for fast Python dependency management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:/root/.local/bin:$PATH"

# Clone and install hermes-agent
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent
WORKDIR /opt/hermes-agent
RUN uv venv .venv --python 3.11 && \
    .venv/bin/pip install -e ".[all]" --quiet 2>&1 | tail -5

# ── Install Node bridge server deps ───────────────────────────────────────────
WORKDIR /app
COPY package.json .
RUN npm install --production --quiet

# ── Copy bridge server ─────────────────────────────────────────────────────────
COPY server.js .

# ── Setup workspace ─────────────────────────────────────────────────────────
RUN mkdir -p /workspace /opt/hermes-home
ENV HERMES_HOME=/opt/hermes-home
ENV HERMES_AGENT_DIR=/opt/hermes-agent

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:8080/_health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
