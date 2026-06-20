/**
 * llm.ts
 * Unified LLM provider module.
 * Routes model requests to the correct provider.
 * 
 * Two modes:
 * 1. Server-key NVIDIA NIM — uses NVIDIA_NIM_API_KEY from .env
 * 2. BYOK (Bring Your Own Key) — user provides their own key for nvidia-nim, openrouter, or groq
 */

import type { ToolDefinition } from './tools'

export type { ToolDefinition }

export type LLMProvider = 'nvidia-nim' | 'openrouter' | 'groq'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
}

export interface LLMResult {
  content: string
  tokensIn: number
  tokensOut: number
  toolCalls?: Array<{ id: string; function: { name: string; arguments: string } }>
}

/** Resolve the API endpoint for a given provider */
function getEndpoint(provider: LLMProvider): string {
  switch (provider) {
    case 'nvidia-nim':
      return 'https://integrate.api.nvidia.com/v1/chat/completions'
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions'
    case 'groq':
      return 'https://api.groq.com/openai/v1/chat/completions'
  }
}

/** Resolve the API key — BYOK takes priority, otherwise fall back to server .env */
function resolveApiKey(provider: LLMProvider, byokApiKey?: string): string {
  if (byokApiKey) return byokApiKey
  // Only server-key mode is NVIDIA NIM
  if (provider === 'nvidia-nim') return process.env.NVIDIA_NIM_API_KEY || ''
  return ''
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Unified chat completion.
 * All providers use OpenAI-compatible API (NVIDIA NIM, OpenRouter, Groq).
 *
 * @param model       - Model ID string
 * @param messages    - Conversation messages
 * @param temperature - Sampling temperature
 * @param tools       - Optional tool definitions
 * @param byokProvider - BYOK provider override (null = server NVIDIA NIM)
 * @param byokApiKey   - BYOK API key (null = use server key)
 */
export async function chatCompletion(
  model: string,
  messages: LLMMessage[],
  temperature: number,
  tools?: ToolDefinition[],
  byokProvider?: string | null,
  byokApiKey?: string | null,
): Promise<LLMResult> {
  // Determine provider: BYOK provider or default to nvidia-nim (server key)
  const provider: LLMProvider = (byokProvider as LLMProvider) || 'nvidia-nim'
  const endpoint = getEndpoint(provider)
  const apiKey = resolveApiKey(provider, byokApiKey || undefined)

  if (!apiKey) {
    throw new Error(
      byokProvider
        ? `No API key provided for BYOK provider "${byokProvider}" (model: ${model}). Please enter your API key.`
        : `No NVIDIA NIM API key configured on the server (model: ${model}). Set NVIDIA_NIM_API_KEY in .env.`
    )
  }

  // Build headers — OpenRouter expects extra headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    headers['X-Title'] = 'AgentForge'
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const body: Record<string, unknown> = { model, messages, temperature }
    if (tools && tools.length > 0) body.tools = tools

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    })

    if (!res.ok) {
      if (isRetryable(res.status) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      const errBody = await res.text().catch(() => '')
      throw new Error(`LLM API error (${provider}) ${res.status}: ${errBody}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    const msg = choice?.message

    const result: LLMResult = {
      content: msg?.content || '',
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
    }

    // Include tool calls if present
    if (msg?.tool_calls && msg.tool_calls.length > 0) {
      result.toolCalls = msg.tool_calls
    }

    return result
  }

  throw new Error(`LLM API (${provider}): max retries exceeded`)
}
