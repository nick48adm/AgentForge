FROM node:22-alpine

# Install language runtimes for code execution tool
RUN apk add --no-cache python3 py3-pip

RUN addgroup -S sandboxgrp && adduser -S sandboxuser -G sandboxgrp
WORKDIR /app
COPY server.js .
RUN mkdir -p /workspace && chown sandboxuser:sandboxgrp /workspace /app

USER sandboxuser
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/_health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
