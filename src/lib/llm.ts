/**
 * llm.ts
 * Unified LLM provider module.
 * Routes model requests to Groq, NVIDIA NIM, or OpenAI based on model name.
 */

const NIM_MODELS = [
  'moonshotai/kimi-k2.6',
  'z-ai/glm-5.1',
  'deepseek-ai/deepseek-v4-pro',
  'deepseek-ai/deepseek-v4-flash',
]

const GROQ_PREFIXES = [
  'llama', 'mixtral', 'gemma', 'whisper', 'distil-whisper',
  'llava', 'qwen', 'deepseek', 'mistral', 'allam',
]

export type LLMProvider = 'groq' | 'nvidia-nim' | 'openai'

export function getProviderForModel(model: string): LLMProvider {
  if (NIM_MODELS.includes(model)) return 'nvidia-nim'

  const lower = model.toLowerCase()
  if (GROQ_PREFIXES.some(p => lower.startsWith(p))) return 'groq'

  // Fallback: if GROQ_API_KEY is set and model doesn't look like an OpenAI model, use Groq
  if (process.env.GROQ_API_KEY && !lower.startsWith('gpt-') && !lower.startsWith('o1') && !lower.startsWith('o3') && !lower.startsWith('o4')) {
    return 'groq'
  }

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
