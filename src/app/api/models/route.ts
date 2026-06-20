import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

interface ModelInfo {
  id: string
  label: string
  description: string
}

// ── NVIDIA NIM models (server-key, free for users) ────────────────────────────
const NIM_MODELS: ModelInfo[] = [
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', description: 'Moonshot reasoning model' },
  { id: 'z-ai/glm-5.1', label: 'GLM 5.1', description: 'Z-AI agentic model' },
  { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: '1M context reasoning model' },
  { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast MoE model' },
]

// ── BYOK provider model catalogues ────────────────────────────────────────────
const BYOK_NVIDIA_NIM_MODELS: ModelInfo[] = [
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', description: 'Moonshot reasoning model' },
  { id: 'z-ai/glm-5.1', label: 'GLM 5.1', description: 'Z-AI agentic model' },
  { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: '1M context reasoning' },
  { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast MoE model' },
  { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', description: 'Meta open-weight model' },
  { id: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', label: 'Nemotron Ultra 253B', description: 'NVIDIA flagship reasoning' },
]

const BYOK_OPENROUTER_MODELS: ModelInfo[] = [
  { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro', description: 'Google flagship model' },
  { id: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash', description: 'Google fast model' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', description: 'Anthropic balanced model' },
  { id: 'anthropic/claude-opus-4', label: 'Claude Opus 4', description: 'Anthropic most capable' },
  { id: 'openai/gpt-4o', label: 'GPT-4o', description: 'OpenAI multimodal flagship' },
  { id: 'openai/o4-mini', label: 'o4 Mini', description: 'OpenAI fast reasoning' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1', description: 'DeepSeek reasoning model' },
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick', description: 'Meta latest model' },
]

const BYOK_GROQ_MODELS: ModelInfo[] = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Meta — fast inference on Groq' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', description: 'Ultra-fast small model' },
  { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', description: 'Mistral MoE model' },
  { id: 'gemma2-9b-it', label: 'Gemma 2 9B', description: 'Google open model' },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 70B', description: 'DeepSeek reasoning distilled' },
  { id: 'qwen-qwq-32b', label: 'Qwen QwQ 32B', description: 'Alibaba reasoning model' },
]

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  return NextResponse.json({
    // Server-key NVIDIA NIM models (always available)
    nim: process.env.NVIDIA_NIM_API_KEY ? NIM_MODELS : [],
    // BYOK catalogues (always returned — client shows them when user enters a key)
    byok: {
      'nvidia-nim': BYOK_NVIDIA_NIM_MODELS,
      openrouter: BYOK_OPENROUTER_MODELS,
      groq: BYOK_GROQ_MODELS,
    },
  })
}
