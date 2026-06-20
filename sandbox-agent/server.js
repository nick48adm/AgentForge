/**
 * sandbox-agent/server.js
 * Bridge server running inside each isolated Docker container.
 *
 * This server drives the hermes-agent Python CLI as a subprocess, giving each
 * agent its own persistent hermes instance with skills, memory, and the full
 * agentic loop — exactly like the Hermes agent experience, but sandboxed per
 * user agent and accessible via HTTP.
 *
 * Routes:
 *   GET  /_health          → health check
 *   PATCH /_admin/reconfigure → hot-reload agent config
 *   POST /chat             → send message, get streamed/buffered reply
 */

import http from 'http'
import { spawn, execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import path from 'path'

const PORT         = parseInt(process.env.INTERNAL_PORT || '8080', 10)
const AGENT_ID     = process.env.AGENT_ID || 'unknown'
const WORKSPACE    = '/workspace'
const HERMES_HOME  = process.env.HERMES_HOME || '/opt/hermes-home'
const HERMES_DIR   = process.env.HERMES_AGENT_DIR || '/opt/hermes-agent'
const HERMES_BIN   = path.join(HERMES_DIR, '.venv/bin/python')
const HERMES_CLI   = path.join(HERMES_DIR, 'cli.py')
const SANDBOX_SECRET = process.env.SANDBOX_SECRET || ''

// Maximum number of concurrent hermes processes to prevent memory exhaustion
const MAX_HERMES_PROCESSES = parseInt(process.env.MAX_HERMES_PROCESSES || '10', 10)

// Mutable config — hot-reloadable via PATCH /_admin/reconfigure
let config = {
  name:         process.env.AGENT_NAME || 'Agent',
  systemPrompt: process.env.AGENT_SYSTEM_PROMPT || '',
  model:        process.env.AGENT_MODEL || 'deepseek-ai/deepseek-v4-flash',
  temperature:  parseFloat(process.env.AGENT_TEMPERATURE || '0.7'),
  tools:        (() => { try { return JSON.parse(process.env.AGENT_TOOLS || '[]') } catch { return [] } })(),
  byokProvider: process.env.BYOK_PROVIDER || null,   // 'nvidia-nim' | 'openrouter' | 'groq' | null
  byokApiKey:   process.env.BYOK_API_KEY || null,     // user's own API key
}

mkdirSync(WORKSPACE, { recursive: true })
mkdirSync(HERMES_HOME, { recursive: true })

// ── Hermes config bootstrap ────────────────────────────────────────────────────
// Write ~/.hermes/config.yaml so hermes-agent uses the right model + keys
function writeHermesConfig() {
  const cfgDir = path.join(HERMES_HOME, '.hermes')
  mkdirSync(cfgDir, { recursive: true })

  // Determine provider: BYOK provider or default to nvidia-nim (server key)
  const provider = config.byokProvider || 'nvidia-nim'
  const apiKey = config.byokApiKey || process.env.NVIDIA_NIM_API_KEY || ''

  // Build YAML config for hermes
  const cfg = `
provider: ${provider}
model: ${config.model}
temperature: ${config.temperature}
workspace: ${WORKSPACE}

providers:
  nvidia-nim:
    api_key: "${provider === 'nvidia-nim' ? apiKey : process.env.NVIDIA_NIM_API_KEY || ''}"
  openrouter:
    api_key: "${provider === 'openrouter' ? apiKey : ''}"
  groq:
    api_key: "${provider === 'groq' ? apiKey : ''}"

tools:
  enabled: [${Array.isArray(config.tools) ? config.tools.map(t => `"${t}"`).join(', ') : ''}]
  web_search:
    serpapi_key: "${process.env.SERPAPI_KEY || ''}"
    brave_key: "${process.env.BRAVE_SEARCH_KEY || ''}"
`.trim()

  writeFileSync(path.join(cfgDir, 'config.yaml'), cfg, 'utf8')

  // Write SOUL.md (system prompt → hermes persona file)
  if (config.systemPrompt) {
    writeFileSync(path.join(cfgDir, 'SOUL.md'), config.systemPrompt, 'utf8')
  }
}

writeHermesConfig()

// ── Hermes conversation session ────────────────────────────────────────────────
// We keep one persistent hermes process per user session (keyed by userId).
// The process stays alive between messages — hermes maintains its own memory.
const hermesProcesses = new Map() // userId -> { proc, queue, pendingResolve }

function getHermesEnv() {
  return {
    ...process.env,
    HOME: HERMES_HOME,
    HERMES_HOME,
    PATH: `/opt/hermes-agent/.venv/bin:${process.env.PATH}`,
    PYTHONPATH: HERMES_DIR,
    NVIDIA_NIM_API_KEY: process.env.NVIDIA_NIM_API_KEY || '',
    SERPAPI_KEY: process.env.SERPAPI_KEY || '',
    BRAVE_SEARCH_KEY: process.env.BRAVE_SEARCH_KEY || '',
  }
}

/**
 * Spawn a hermes-agent process in batch/pipe mode for a user session.
 */
function spawnHermesProcess(userId) {
  const session = { buffer: '', pendingResolve: null, pendingReject: null, ready: false }

  // Use run_agent.py if available (headless mode), otherwise fall back to cli.py
  const agentScript = existsSync(path.join(HERMES_DIR, 'run_agent.py'))
    ? path.join(HERMES_DIR, 'run_agent.py')
    : HERMES_CLI

  const proc = spawn(HERMES_BIN, [agentScript, '--non-interactive'], {
    env: getHermesEnv(),
    cwd: WORKSPACE,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stderrBuf = ''
  proc.stderr.on('data', d => {
    stderrBuf += d.toString()
    // Check for ready signal
    if (!session.ready && (stderrBuf.includes('ready') || stderrBuf.includes('Hermes'))) {
      session.ready = true
      console.log(`[hermes] Session ${userId} ready`)
    }
  })

  const RESPONSE_END_MARKER = '\x00HERMES_END\x00'

  proc.stdout.on('data', d => {
    session.buffer += d.toString()
    const endIdx = session.buffer.indexOf(RESPONSE_END_MARKER)
    if (endIdx !== -1 && session.pendingResolve) {
      const response = session.buffer.slice(0, endIdx).trim()
      session.buffer = session.buffer.slice(endIdx + RESPONSE_END_MARKER.length)
      const resolve = session.pendingResolve
      session.pendingResolve = null
      session.pendingReject = null
      resolve(response)
    }
  })

  proc.on('error', err => {
    console.error(`[hermes] Process error for ${userId}:`, err.message)
    if (session.pendingReject) {
      session.pendingReject(err)
      session.pendingResolve = null
      session.pendingReject = null
    }
    hermesProcesses.delete(userId)
  })

  proc.on('exit', (code) => {
    console.log(`[hermes] Process for ${userId} exited with code ${code}`)
    if (session.pendingReject) {
      session.pendingReject(new Error(`Hermes process exited (code ${code})`))
      session.pendingResolve = null
      session.pendingReject = null
    }
    hermesProcesses.delete(userId)
  })

  return { proc, session }
}

/**
 * Send a message to the hermes process and await the response.
 * Falls back to direct LLM API if hermes can't be used.
 */
async function chatWithHermes(userId, message, conversationHistory) {
  // Try hermes process first
  try {
    return await chatWithHermesProcess(userId, message, conversationHistory)
  } catch (err) {
    console.error('[hermes] Process chat failed, falling back to direct LLM:', err.message)
    return await directLLMChat(message, conversationHistory)
  }
}

async function chatWithHermesProcess(userId, message, conversationHistory) {
  // Check if hermes binary exists
  if (!existsSync(HERMES_BIN)) {
    throw new Error('Hermes binary not found')
  }

  // Enforce max process limit
  if (hermesProcesses.size >= MAX_HERMES_PROCESSES) {
    // Kill the oldest process to make room
    const oldestKey = hermesProcesses.keys().next().value
    const oldest = hermesProcesses.get(oldestKey)
    if (oldest?.proc) oldest.proc.kill()
    hermesProcesses.delete(oldestKey)
    console.log(`[hermes] Killed oldest process ${oldestKey} to stay under limit`)
  }

  let entry = hermesProcesses.get(userId)
  if (!entry || entry.proc.exitCode !== null) {
    const { proc, session } = spawnHermesProcess(userId)
    entry = { proc, session }
    hermesProcesses.set(userId, entry)
    // Give process time to initialize
    await new Promise(r => setTimeout(r, 2000))
  }

  const { proc, session } = entry

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      session.pendingResolve = null
      session.pendingReject = null
      reject(new Error('Hermes response timeout (60s)'))
    }, 60_000)

    session.pendingResolve = (response) => {
      clearTimeout(timeout)
      resolve({ content: response, tokensIn: 0, tokensOut: 0 })
    }
    session.pendingReject = (err) => {
      clearTimeout(timeout)
      reject(err)
    }

    // Send the message as a JSON line to hermes stdin
    const payload = JSON.stringify({ message, history: conversationHistory.slice(-20) }) + '\n'
    proc.stdin.write(payload)
  })
}

// ── Direct LLM fallback (used when hermes process unavailable) ─────────────────
// All providers use OpenAI-compatible chat/completions endpoint.
const PROVIDER_ENDPOINTS = {
  'nvidia-nim': 'https://integrate.api.nvidia.com/v1/chat/completions',
  'openrouter': 'https://openrouter.ai/api/v1/chat/completions',
  'groq':       'https://api.groq.com/openai/v1/chat/completions',
}

function getLLMEndpoint() {
  // BYOK provider takes priority, otherwise default to nvidia-nim (server key)
  const provider = config.byokProvider || 'nvidia-nim'
  const endpoint = PROVIDER_ENDPOINTS[provider] || PROVIDER_ENDPOINTS['nvidia-nim']
  const apiKey = config.byokApiKey || process.env.NVIDIA_NIM_API_KEY || ''
  return { endpoint, apiKey, provider }
}

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Execute Python or Node.js code and return stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['python', 'node'] },
          code: { type: 'string' },
        },
        required: ['language', 'code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the agent workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file in the agent workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'http_request',
      description: 'Make an outbound HTTP GET or POST request.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST'] },
          body: { type: 'string' },
        },
        required: ['url'],
      },
    },
  },
]

/**
 * Secure path resolution — prevents path traversal attacks.
 * Only allows access to files within the WORKSPACE directory.
 */
function resolveSafePath(inputPath) {
  // Normalize the path to handle various traversal techniques
  const normalized = path.normalize(inputPath)
  // Remove any remaining ../ patterns and null bytes
  const cleaned = normalized.replace(/\0/g, '').replace(/\.\./g, '')
  const safePath = path.join(WORKSPACE, cleaned)
  // Verify the resolved path is within WORKSPACE
  if (!safePath.startsWith(WORKSPACE + path.sep) && safePath !== WORKSPACE) {
    return null // Path traversal detected
  }
  return safePath
}

async function executeTool(name, args) {
  switch (name) {
    case 'web_search': {
      const key = process.env.SERPAPI_KEY || process.env.BRAVE_SEARCH_KEY
      if (!key) return { error: 'No search API key configured' }
      try {
        const url = process.env.SERPAPI_KEY
          ? `https://serpapi.com/search.json?q=${encodeURIComponent(args.query)}&num=5&api_key=${key}`
          : `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=5`
        const headers = process.env.BRAVE_SEARCH_KEY ? { Accept: 'application/json', 'X-Subscription-Token': key } : {}
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
        const data = await res.json()
        const results = process.env.SERPAPI_KEY
          ? (data.organic_results || []).slice(0, 5).map(r => `${r.title}\n${r.snippet}\n${r.link}`)
          : (data.web?.results || []).slice(0, 5).map(r => `${r.title}\n${r.description}\n${r.url}`)
        return { results: results.join('\n\n') || 'No results found.' }
      } catch (e) { return { error: e.message } }
    }

    case 'run_code': {
      const { language, code } = args
      const tmpFile = `/tmp/code_${randomUUID()}.${language === 'python' ? 'py' : 'js'}`
      try {
        writeFileSync(tmpFile, code)
        const cmd = language === 'python' ? 'python3' : 'node'
        return await new Promise(resolve => {
          let stdout = '', stderr = ''
          const proc = spawn(cmd, [tmpFile], { timeout: 10000, env: { PATH: '/usr/bin:/usr/local/bin' } })
          proc.stdout.on('data', d => { stdout += d; if (stdout.length > 10000) proc.kill() })
          proc.stderr.on('data', d => { stderr += d; if (stderr.length > 5000) proc.kill() })
          proc.on('close', code => resolve({ stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 5000), exitCode: code }))
          proc.on('error', e => resolve({ error: e.message }))
        })
      } catch (e) { return { error: e.message } }
    }

    case 'read_file': {
      const safePath = resolveSafePath(args.path || '')
      if (!safePath) return { error: 'Access denied: path outside workspace' }
      try { return { content: readFileSync(safePath, 'utf8').slice(0, 50000) } }
      catch (e) { return { error: e.message } }
    }

    case 'write_file': {
      const safePath = resolveSafePath(args.path || '')
      if (!safePath) return { error: 'Access denied: path outside workspace' }
      try {
        const content = typeof args.content === 'string' ? args.content : ''
        writeFileSync(safePath, content, 'utf8')
        return { success: true, path: args.path }
      } catch (e) { return { error: e.message } }
    }

    case 'http_request': {
      try {
        const url = new URL(args.url)
        // Block private/reserved IP ranges (SSRF prevention)
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
        const blockedRanges = ['169.254.', '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.2', '172.3']
        if (blockedHosts.includes(url.hostname)) return { error: 'Access to private addresses is not allowed' }
        if (blockedRanges.some(r => url.hostname.startsWith(r))) return { error: 'Access to private addresses is not allowed' }
        // Block non-http(s) protocols
        if (!['http:', 'https:'].includes(url.protocol)) return { error: 'Only HTTP/HTTPS requests are allowed' }

        const res = await fetch(args.url, {
          method: args.method || 'GET',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'AgentForge/1.0' },
          body: args.method === 'POST' && args.body ? args.body : undefined,
          signal: AbortSignal.timeout(10000),
        })
        return { status: res.status, body: (await res.text()).slice(0, 10000) }
      } catch (e) { return { error: e.message } }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

async function directLLMChat(message, conversationHistory) {
  const { endpoint, apiKey, provider } = getLLMEndpoint()
  if (!apiKey) throw new Error(
    config.byokProvider
      ? `No API key provided for BYOK provider "${config.byokProvider}". Please enter your API key.`
      : 'No NVIDIA NIM API key configured on the server. Set NVIDIA_NIM_API_KEY in .env.'
  )

  const llmMessages = []
  if (config.systemPrompt) llmMessages.push({ role: 'system', content: config.systemPrompt })
  for (const m of conversationHistory.slice(-20)) {
    if (m.role === 'user' || m.role === 'assistant') llmMessages.push({ role: m.role, content: m.content })
  }
  llmMessages.push({ role: 'user', content: message })

  // Build headers — all providers use OpenAI-compatible API
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  // OpenRouter expects extra headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    headers['X-Title'] = 'AgentForge'
  }

  const enabledTools = Array.isArray(config.tools) ? config.tools : []
  const toolDefs = enabledTools.length > 0
    ? TOOL_DEFINITIONS.filter(t => enabledTools.includes(t.function.name))
    : []

  const body = { model: config.model, messages: llmMessages, temperature: config.temperature }
  if (toolDefs.length > 0) body.tools = toolDefs

  // Agentic tool loop — up to 5 rounds (all providers use OpenAI-compatible API)
  let currentMessages = [...llmMessages]
  for (let round = 0; round < 5; round++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, messages: currentMessages }),
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) throw new Error(`LLM API (${provider}) ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const choice = data.choices?.[0]
    const msg = choice?.message
    if (!msg) break

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        content: msg.content || 'No response generated.',
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
      }
    }

    currentMessages.push(msg)
    const toolResults = await Promise.all(
      msg.tool_calls.map(async tc => {
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        const result = await executeTool(tc.function.name, args)
        return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) }
      })
    )
    currentMessages.push(...toolResults)
  }

  return { content: 'Maximum tool call rounds reached.', tokensIn: 0, tokensOut: 0 }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => {
      data += c
      // Limit request body size to 1MB
      if (data.length > 1e6) {
        req.destroy()
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { reject(new Error('Invalid JSON')) } })
    req.on('error', reject)
  })
}
function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}
function authOk(req) {
  if (!SANDBOX_SECRET) return true
  // Constant-time comparison for the secret token
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token.length !== SANDBOX_SECRET.length) return false
  return Buffer.compare(Buffer.from(token), Buffer.from(SANDBOX_SECRET)) === 0
}

// ── HTTP server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url  = req.url  || '/'
  const method = req.method || 'GET'

  if (url === '/_health' && method === 'GET') {
    return send(res, 200, { ok: true, agentId: AGENT_ID, name: config.name, model: config.model })
  }

  if (url === '/_admin/reconfigure' && method === 'PATCH') {
    if (!authOk(req)) return send(res, 401, { error: 'Unauthorized' })
    try {
      const body = await readBody(req)
      if (body.systemPrompt !== undefined) config.systemPrompt = body.systemPrompt
      if (body.temperature !== undefined)  config.temperature = parseFloat(body.temperature)
      if (body.model       !== undefined)  config.model = body.model
      if (body.tools       !== undefined)  config.tools = typeof body.tools === 'string' ? JSON.parse(body.tools) : body.tools
      if (body.byokProvider !== undefined) config.byokProvider = body.byokProvider || null
      if (body.byokApiKey  !== undefined)  config.byokApiKey = body.byokApiKey || null
      // Rewrite hermes config on hot-reload
      writeHermesConfig()
      // Kill existing hermes processes so they pick up new config
      for (const [uid, { proc }] of hermesProcesses) {
        proc.kill()
        hermesProcesses.delete(uid)
      }
      console.log('[sandbox] Config hot-reloaded, hermes sessions reset')
      return send(res, 200, { ok: true })
    } catch (e) { return send(res, 400, { error: e.message }) }
  }

  if (url === '/chat' && method === 'POST') {
    if (!authOk(req)) return send(res, 401, { error: 'Unauthorized' })
    try {
      const { message, conversationHistory = [], userId = 'anon' } = await readBody(req)
      if (!message) return send(res, 400, { error: 'message is required' })
      if (typeof message !== 'string' || message.length > 10000) {
        return send(res, 400, { error: 'message must be a string under 10000 characters' })
      }
      const result = await chatWithHermes(userId, message, conversationHistory)
      return send(res, 200, result)
    } catch (e) {
      console.error('[chat error]', e)
      return send(res, 500, { error: 'Internal server error' })
    }
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sandbox-agent] ${config.name} (${AGENT_ID}) ready on :${PORT}`)
  console.log(`[sandbox-agent] Model: ${config.model} | Tools: ${Array.isArray(config.tools) ? config.tools.join(', ') || 'none' : 'none'}`)
  console.log(`[sandbox-agent] Hermes home: ${HERMES_HOME}`)
  console.log(`[sandbox-agent] Max hermes processes: ${MAX_HERMES_PROCESSES}`)
})

process.on('SIGTERM', () => {
  console.log('[sandbox-agent] Shutting down…')
  for (const { proc } of hermesProcesses.values()) proc.kill()
  server.close(() => process.exit(0))
})
