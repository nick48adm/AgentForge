/**
 * sandbox-agent/server.js
 * Runs INSIDE each Docker container. Handles chat, tools, health, and hot-reload.
 * Tools: web_search, run_code (Python/Node), read_file, write_file, http_request
 */
import http from 'http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

const PORT = parseInt(process.env.INTERNAL_PORT || '8080', 10)
const AGENT_ID = process.env.AGENT_ID || 'unknown'
const WORKSPACE = '/workspace'
const CONV_FILE = `${WORKSPACE}/conversations.json`
const SANDBOX_SECRET = process.env.SANDBOX_SECRET || ''

// Mutable agent config (hot-reloadable)
let config = {
  name: process.env.AGENT_NAME || 'Agent',
  systemPrompt: process.env.AGENT_SYSTEM_PROMPT || '',
  model: process.env.AGENT_MODEL || 'gpt-4o',
  temperature: parseFloat(process.env.AGENT_TEMPERATURE || '0.7'),
  tools: (() => { try { return JSON.parse(process.env.AGENT_TOOLS || '[]') } catch { return [] } })(),
}

mkdirSync(WORKSPACE, { recursive: true })

// ── Persistence ───────────────────────────────────────────────────────────────
function loadConversations() {
  try { return existsSync(CONV_FILE) ? JSON.parse(readFileSync(CONV_FILE, 'utf8')) : {} } catch { return {} }
}
function saveConversations(data) {
  try { writeFileSync(CONV_FILE, JSON.stringify(data), 'utf8') } catch (e) { console.error('save err:', e) }
}

// ── Tool execution ────────────────────────────────────────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current information.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Execute Python or Node.js code in a sandboxed environment. Returns stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', enum: ['python', 'node'] },
          code: { type: 'string', description: 'Code to execute' },
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
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative path within workspace' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file in the agent workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path within workspace' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'http_request',
      description: 'Make an outbound HTTP request to a URL (GET/POST only).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST'] },
          body: { type: 'string', description: 'JSON body for POST requests' },
        },
        required: ['url'],
      },
    },
  },
]

async function executeTool(name, args) {
  switch (name) {
    case 'web_search': {
      const key = process.env.SERPAPI_KEY || process.env.BRAVE_SEARCH_KEY
      if (!key) return { error: 'No search API key configured' }
      try {
        const url = process.env.SERPAPI_KEY
          ? `https://serpapi.com/search.json?q=${encodeURIComponent(args.query)}&num=5&api_key=${key}`
          : `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=5`
        const headers = process.env.BRAVE_SEARCH_KEY ? { 'Accept': 'application/json', 'X-Subscription-Token': key } : {}
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
        const data = await res.json()
        const results = process.env.SERPAPI_KEY
          ? (data.organic_results || []).slice(0, 5).map(r => `${r.title}\n${r.snippet}\n${r.link}`)
          : (data.web?.results || []).slice(0, 5).map(r => `${r.title}\n${r.description}\n${r.url}`)
        return { results: results.join('\n\n') || 'No results found.' }
      } catch (e) { return { error: e.message } }
    }

    case 'run_code': {
      // Code executes inside this already-sandboxed container
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
      const safePath = `${WORKSPACE}/${args.path.replace(/\.\.\//g, '')}`
      if (!safePath.startsWith(WORKSPACE)) return { error: 'Access denied: path outside workspace' }
      try {
        const content = readFileSync(safePath, 'utf8')
        return { content: content.slice(0, 50000) }
      } catch (e) { return { error: e.message } }
    }

    case 'write_file': {
      const safePath = `${WORKSPACE}/${args.path.replace(/\.\.\//g, '')}`
      if (!safePath.startsWith(WORKSPACE)) return { error: 'Access denied: path outside workspace' }
      try {
        writeFileSync(safePath, args.content, 'utf8')
        return { success: true, path: args.path }
      } catch (e) { return { error: e.message } }
    }

    case 'http_request': {
      // Block private IP ranges
      const url = new URL(args.url)
      const blocked = ['localhost','127.0.0.1','0.0.0.0','::1','169.254','10.','192.168.','172.']
      if (blocked.some(b => url.hostname.startsWith(b))) return { error: 'Access to private addresses is not allowed' }
      try {
        const res = await fetch(args.url, {
          method: args.method || 'GET',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'AgentForge/1.0' },
          body: args.method === 'POST' && args.body ? args.body : undefined,
          signal: AbortSignal.timeout(10000),
        })
        const text = await res.text()
        return { status: res.status, body: text.slice(0, 10000) }
      } catch (e) { return { error: e.message } }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── LLM call with agentic tool loop ──────────────────────────────────────────
async function callLLM(messages, useTools = true) {
  // Determine provider from model
  const nimModels = ['moonshotai/kimi-k2.6', 'z-ai/glm-5.1', 'deepseek-ai/deepseek-v4-pro', 'deepseek-ai/deepseek-v4-flash']
  let apiKey, endpoint
  if (nimModels.includes(config.model)) {
    apiKey = process.env.NVIDIA_NIM_API_KEY
    endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions'
  } else if (process.env.GROQ_API_KEY) {
    apiKey = process.env.GROQ_API_KEY
    endpoint = 'https://api.groq.com/openai/v1/chat/completions'
  } else if (process.env.OPENAI_API_KEY) {
    apiKey = process.env.OPENAI_API_KEY
    endpoint = 'https://api.openai.com/v1/chat/completions'
  }
  if (!apiKey) throw new Error('No LLM API key configured in sandbox')

  const enabledTools = Array.isArray(config.tools) ? config.tools : []
  const toolDefs = useTools && enabledTools.length > 0
    ? TOOL_DEFINITIONS.filter(t => enabledTools.includes(t.function.name))
    : []

  const body = { model: config.model, messages, temperature: config.temperature }
  if (toolDefs.length > 0) body.tools = toolDefs

  // Agentic loop — max 5 tool call rounds
  let currentMessages = [...messages]
  for (let round = 0; round < 5; round++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ ...body, messages: currentMessages }),
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) throw new Error(`LLM API ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const choice = data.choices?.[0]
    const msg = choice?.message

    if (!msg) break

    // No tool calls — final text response
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        content: msg.content || 'No response.',
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
      }
    }

    // Execute all tool calls in parallel
    currentMessages.push(msg)
    const toolResults = await Promise.all(
      msg.tool_calls.map(async tc => {
        let args = {}
        try { args = JSON.parse(tc.function.arguments) } catch {}
        const result = await executeTool(tc.function.name, args)
        return {
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        }
      })
    )
    currentMessages.push(...toolResults)
  }

  return { content: 'Maximum tool call rounds reached.', tokensIn: 0, tokensOut: 0 }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(new Error('Body too large')) })
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
  const h = req.headers.authorization || ''
  return h === `Bearer ${SANDBOX_SECRET}`
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/'
  const method = req.method || 'GET'

  if (url === '/_health' && method === 'GET') {
    return send(res, 200, { ok: true, agentId: AGENT_ID, name: config.name })
  }

  if (url === '/_admin/reconfigure' && method === 'PATCH') {
    if (!authOk(req)) return send(res, 401, { error: 'Unauthorized' })
    try {
      const body = await readBody(req)
      if (body.systemPrompt !== undefined) config.systemPrompt = body.systemPrompt
      if (body.temperature !== undefined) config.temperature = parseFloat(body.temperature)
      if (body.tools !== undefined) config.tools = typeof body.tools === 'string' ? JSON.parse(body.tools) : body.tools
      console.log('[sandbox] Config hot-reloaded')
      return send(res, 200, { ok: true })
    } catch (e) { return send(res, 400, { error: e.message }) }
  }

  if (url === '/chat' && method === 'POST') {
    if (!authOk(req)) return send(res, 401, { error: 'Unauthorized' })
    try {
      const { message, conversationHistory = [], userId = 'anon' } = await readBody(req)
      if (!message) return send(res, 400, { error: 'message is required' })

      const llmMessages = []
      if (config.systemPrompt) llmMessages.push({ role: 'system', content: config.systemPrompt })
      for (const m of conversationHistory.slice(-20)) {
        if (m.role === 'user' || m.role === 'assistant') llmMessages.push({ role: m.role, content: m.content })
      }
      llmMessages.push({ role: 'user', content: message })

      const result = await callLLM(llmMessages)

      // Persist to workspace
      const convs = loadConversations()
      if (!convs[userId]) convs[userId] = []
      convs[userId].push(
        { role: 'user', content: message, ts: new Date().toISOString() },
        { role: 'assistant', content: result.content, ts: new Date().toISOString() }
      )
      if (convs[userId].length > 200) convs[userId] = convs[userId].slice(-200)
      saveConversations(convs)

      return send(res, 200, result)
    } catch (e) {
      console.error('[chat error]', e)
      return send(res, 500, { error: e.message })
    }
  }

  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sandbox-agent] ${config.name} (${AGENT_ID}) ready on :${PORT}`)
  console.log(`[sandbox-agent] Tools enabled: ${Array.isArray(config.tools) ? config.tools.join(', ') || 'none' : 'none'}`)
})

process.on('SIGTERM', () => { console.log('[sandbox-agent] Shutting down…'); server.close(() => process.exit(0)) })
