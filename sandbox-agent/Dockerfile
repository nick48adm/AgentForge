FROM node:22-alpine

# ── System dependencies ────────────────────────────────────────────────────────
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    curl \
    ripgrep \
    ffmpeg \
    make \
    g++ \
    linux-headers

# ── Install uv for fast Python dependency management ───────────────────────────
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:/root/.local/bin:$PATH"

# ── Install hermes-agent (NousResearch) ───────────────────────────────────────
ARG HERMES_VERSION=main
RUN git clone --depth 1 --branch ${HERMES_VERSION} https://github.com/NousResearch/hermes-agent.git /opt/hermes-agent
WORKDIR /opt/hermes-agent
RUN uv venv .venv --python 3.11 && \
    .venv/bin/pip install -e ".[all]" --quiet 2>&1 | tail -5

# ── Install Node bridge server deps ───────────────────────────────────────────
WORKDIR /app
COPY package.json .
RUN npm install --production --quiet

# ── Copy bridge server ─────────────────────────────────────────────────────────
COPY server.js .

# ── Setup workspace and non-root user ──────────────────────────────────────────
RUN mkdir -p /workspace /opt/hermes-home && \
    addgroup --system sandbox && \
    adduser --system --ingroup sandbox sandbox && \
    chown -R sandbox:sandbox /workspace /opt/hermes-home /app /opt/hermes-agent

ENV HERMES_HOME=/opt/hermes-home
ENV HERMES_AGENT_DIR=/opt/hermes-agent
ENV PATH="/opt/hermes-agent/.venv/bin:$PATH"

# Note: Running as root is needed to access hermes venv installed in /opt/hermes-agent
# In a true multi-tenant deployment, hermes would be installed in a shared location
# USER sandbox

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:8080/_health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]