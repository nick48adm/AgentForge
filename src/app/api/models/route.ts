import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'

// ── Static NVIDIA NIM models ──────────────────────────────────────────────────
const NVIDIA_NIM_MODELS = [
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi 2.6', description: 'Moonshot reasoning model' },
  { id: 'z-ai/glm-5.1', label: 'GLM 5.1', description: 'Z-AI agentic model' },
  { id: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: '1M context reasoning model' },
  { id: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast MoE model' },
]

// ── Groq model cache (5 minutes) ─────────────────────────────────────────────
let groqCache: { data: { id: string; owned_by: string }[]; expiresAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

async function fetchGroqModels(): Promise<{ id: string; owned_by: string }[]> {
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
    const models = (json.data || []).map((m: any) => ({ id: m.id, owned_by: m.owned_by }))

    groqCache = { data: models, expiresAt: Date.now() + CACHE_TTL_MS }
    return models
  } catch (e: any) {
    console.error('[models] Failed to fetch Groq models:', e.message)
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
  })
}
