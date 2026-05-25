/**
 * llm.ts
 * Unified LLM provider module.
 * Routes model requests to the correct provider based on model name.
 * Supports: Groq, NVIDIA NIM, OpenAI, Anthropic
 */

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

async function anthropicChatCompletion(
  model: string,
  messages: any[],
  temperature: number,
  apiKey: string
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  // Separate system message from conversation
  const systemMsg = messages.find(m => m.role === 'system')
  const conversationMsgs = messages.filter(m => m.role !== 'system')

  const body: any = {
    model,
    max_tokens: 4096,
    temperature,
    messages: conversationMsgs,
  }
  if (systemMsg) body.system = systemMsg.content

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
    const body = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

  return {
    content: text,
    tokensIn: data.usage?.input_tokens || 0,
    tokensOut: data.usage?.output_tokens || 0,
  }
}

export async function chatCompletion(
  model: string,
  messages: any[],
  temperature: number
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const provider = getProviderForModel(model)
  const { endpoint, apiKey } = getEndpointAndKey(provider)

  if (!apiKey) {
    throw new Error(`No API key configured for provider "${provider}" (model: ${model})`)
  }

  // Anthropic uses a different API shape
  if (provider === 'anthropic') {
    return anthropicChatCompletion(model, messages, temperature, apiKey)
  }

  // OpenAI-compatible API (Groq, NIM, OpenAI)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
    signal: AbortSignal.timeout(55000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`LLM API error (${provider}) ${res.status}: ${body}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]

  return {
    content: choice?.message?.content || '',
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0,
  }
}
