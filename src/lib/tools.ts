/**
 * tools.ts
 * Server-side tool execution engine.
 * Enables web_search and webhook tools for both draft-mode chat AND sandboxed agents.
 */

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

// ── Tool definitions (OpenAI function-calling format) ───────────────────────
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for current information. Returns top results with titles, snippets, and URLs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'http_request',
      description: 'Make an outbound HTTP GET or POST request to an external API.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to request' },
          method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP method' },
          body: { type: 'string', description: 'Request body for POST requests' },
          headers: { type: 'object', description: 'Optional custom headers' },
        },
        required: ['url'],
      },
    },
  },
]

export interface ToolResult {
  success: boolean
  data: string
}

/**
 * Execute a tool call server-side.
 * Only web_search and http_request are supported (safe for server execution).
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'web_search': {
      const query = String(args.query || '')
      if (!query) return { success: false, data: 'Missing search query' }

      // Try SerpAPI first, then Brave Search
      const serpKey = process.env.SERPAPI_KEY
      const braveKey = process.env.BRAVE_SEARCH_KEY

      if (!serpKey && !braveKey) {
        return { success: false, data: 'No search API key configured (SERPAPI_KEY or BRAVE_SEARCH_KEY)' }
      }

      try {
        if (serpKey) {
          const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${serpKey}`
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
          if (!res.ok) return { success: false, data: `Search API error: ${res.status}` }
          const data = await res.json()
          const results = (data.organic_results || []).slice(0, 5)
            .map((r: any) => `${r.title}\n${r.snippet}\n${r.link}`)
            .join('\n\n')
          return { success: true, data: results || 'No results found.' }
        }

        // Brave Search fallback
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`
        const res = await fetch(url, {
          headers: { Accept: 'application/json', 'X-Subscription-Token': braveKey! },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return { success: false, data: `Brave Search API error: ${res.status}` }
        const data = await res.json()
        const results = (data.web?.results || []).slice(0, 5)
          .map((r: any) => `${r.title}\n${r.description}\n${r.url}`)
          .join('\n\n')
        return { success: true, data: results || 'No results found.' }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown search error'
        return { success: false, data: `Search failed: ${msg}` }
      }
    }

    case 'http_request': {
      const url = String(args.url || '')
      const method = String(args.method || 'GET').toUpperCase()
      const body = args.body ? String(args.body) : undefined

      if (!url) return { success: false, data: 'Missing URL' }

      // SSRF protection — block private/reserved IPs
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { success: false, data: 'Only HTTP/HTTPS requests are allowed' }
        }
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
        const blockedRanges = ['169.254.', '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.2', '172.3']
        if (blockedHosts.includes(parsed.hostname) || blockedRanges.some(r => parsed.hostname.startsWith(r))) {
          return { success: false, data: 'Access to private addresses is not allowed' }
        }
      } catch {
        return { success: false, data: 'Invalid URL' }
      }

      try {
        const fetchOpts: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'AgentForge/1.0' },
          signal: AbortSignal.timeout(15000),
        }
        if (method === 'POST' && body) fetchOpts.body = body

        const res = await fetch(url, fetchOpts)
        const text = await res.text()
        return { success: true, data: `Status: ${res.status}\n${text.slice(0, 10000)}` }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown request error'
        return { success: false, data: `HTTP request failed: ${msg}` }
      }
    }

    default:
      return { success: false, data: `Unknown tool: ${name}` }
  }
}

/**
 * Filter TOOL_DEFINITIONS to only include the enabled tools for an agent.
 */
export function getEnabledToolDefs(enabledTools: string[]) {
  return TOOL_DEFINITIONS.filter(t => enabledTools.includes(t.function.name))
}
