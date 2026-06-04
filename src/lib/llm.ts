/**
 * llm.ts
 * Unified LLM provider module.
 * Routes model requests to the correct provider based on model name.
 * Supports: Groq, NVIDIA NIM, OpenAI, Anthropic
 */

import type { ToolDefinition } from './tools'

export type { ToolDefinition }

const NIM_MODELS = [
  'moonshotai/kimi-k2.6',
  'z-ai/glm-5.1',
  'deepseek-ai/deepseek-v4-pro',
  'deepseek-ai/deepseek-v4-flash',
]

const ANTHROPIC_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-opus-4',
  'claude-sonnet-4',
]

const GROQ_PREFIXES = [
  'llama', 'mixtral', 'gemma', 'llava', 'qwen', 'deepseek', 'mistral', 'allam',
]

const OPENAI_PREFIXES = ['gpt-', 'o1', 'o3', 'o4']

export type LLMProvider = 'groq' | 'nvidia-nim' | 'openai' | 'anthropic'

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

export function getProviderForModel(model: string): LLMProvider {
  // Explicit lists take priority
  if (NIM_MODELS.includes(model)) return 'nvidia-nim'
  if (ANTHROPIC_MODELS.some(m => model.startsWith(m))) return 'anthropic'

  const lower = model.toLowerCase()
  if (GROQ_PREFIXES.some(p => lower.startsWith(p))) return 'groq'
  if (OPENAI_PREFIXES.some(p => lower.startsWith(p))) return 'openai'

  // Unknown model: pick from available keys in priority order
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.NVIDIA_NIM_API_KEY) return 'nvidia-nim'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'

  return 'openai'
}

function getEndpointAndKey(provider: LLMProvider): { endpoint: string; apiKey: string } {
  switch (provider) {
    case 'groq':
      return {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY || '',
      }
    case 'nvidia-nim':
      return {
        endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey: process.env.NVIDIA_NIM_API_KEY || '',
      }
    case 'openai':
      return {
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: process.env.OPENAI_API_KEY || '',
      }
    case 'anthropic':
      return {
        endpoint: 'https://api.anthropic.com/v1/messages',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      }
  }
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

async function anthropicChatCompletion(
  model: string,
  messages: LLMMessage[],
  temperature: number,
  apiKey: string
): Promise<LLMResult> {
  const systemMsg = messages.find(m => m.role === 'system')
  const conversationMsgs = messages.filter(m => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    temperature,
    messages: conversationMsgs,
  }
  if (systemMsg) body.system = systemMsg.content

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    })

    if (!res.ok) {
      if (isRetryable(res.status) && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      const errBody = await res.text().catch(() => '')
      throw new Error(`Anthropic API error ${res.status}: ${errBody}`)
    }

    const data = await res.json()
    const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text || ''

    return {
      content: text,
      tokensIn: data.usage?.input_tokens || 0,
      tokensOut: data.usage?.output_tokens || 0,
    }
  }

  throw new Error('Anthropic API: max retries exceeded')
}

export async function chatCompletion(
  model: string,
  messages: LLMMessage[],
  temperature: number,
  tools?: ToolDefinition[]
): Promise<LLMResult> {
  const provider = getProviderForModel(model)
  const { endpoint, apiKey } = getEndpointAndKey(provider)

  if (!apiKey) {
    throw new Error(`No API key configured for provider "${provider}" (model: ${model})`)
  }

  // Anthropic uses a different API shape — no tool support in this path
  if (provider === 'anthropic') {
    return anthropicChatCompletion(model, messages, temperature, apiKey)
  }

  // OpenAI-compatible API (Groq, NIM, OpenAI) — with tool support
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const body: Record<string, unknown> = { model, messages, temperature }
    if (tools && tools.length > 0) body.tools = tools

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
