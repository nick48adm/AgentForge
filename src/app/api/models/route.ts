import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

interface GroqModel {
  id: string
  owned_by: string
}

// ── Static NVIDIA NIM models ──────────────────────────────────────────────────
const NVIDIA_NIM_MODELS = [
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi 2.6', description: 'Moonshot reasoning model' },
  { id: 'z-ai/glm-5.1', label: 'GLM 5.1', description: 'Z-AI agentic model' },
  { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: '1M context reasoning model' },
  { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast MoE model' },
]

// ── Static OpenAI models ───────────────────────────────────────────────────────
const OPENAI_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', description: 'OpenAI multimodal flagship' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast & affordable GPT-4o' },
  { id: 'o4-mini', label: 'o4 Mini', description: 'OpenAI fast reasoning model' },
]

// ── Static Anthropic models ────────────────────────────────────────────────────
const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', description: 'Anthropic Sonnet — fast & smart' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5', description: 'Anthropic Opus — most capable' },
]

// ── Groq model cache (5 minutes) ──────────────────────────────────────────────
let groqCache: { data: GroqModel[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

async function fetchGroqModels(): Promise<GroqModel[]> {
  if (groqCache && Date.now() < groqCache.expiresAt) {
    return groqCache.data
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`[models] Groq API error: ${res.status}`)
      return groqCache?.data || []
    }

    const json = await res.json()
    // Filter out audio/whisper models — only keep text chat models
    const models: GroqModel[] = (json.data || [])
      .filter((m: Record<string, unknown>) =>
        typeof m.id === 'string' && !m.id.includes('whisper') && !m.id.includes('distil-whisper')
      )
      .map((m: Record<string, unknown>) => ({
        id: String(m.id),
        owned_by: String(m.owned_by ?? 'unknown'),
      }))
      .sort((a: GroqModel, b: GroqModel) => a.id.localeCompare(b.id))

    groqCache = { data: models, expiresAt: Date.now() + CACHE_TTL_MS }
    return models
  } catch (e: unknown) {
    console.error('[models] Failed to fetch Groq models:', e instanceof Error ? e.message : 'Unknown error')
    return groqCache?.data || []
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  const groq = await fetchGroqModels()

  return NextResponse.json({
    groq,
    nvidia_nim: NVIDIA_NIM_MODELS,
    openai: process.env.OPENAI_API_KEY ? OPENAI_MODELS : [],
    anthropic: process.env.ANTHROPIC_API_KEY ? ANTHROPIC_MODELS : [],
  })
}
