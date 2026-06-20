import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { createAgentSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const agents = await db.agent.findMany({
      where: { userId: auth.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        telegramConnection: true,
        _count: { select: { conversations: true } },
      },
    })
    return NextResponse.json(agents)
  } catch (error: unknown) {
    console.error('[agents GET]', error)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const parsed = createAgentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }
    const { name, description, systemPrompt, model, temperature, tools, avatar, byokProvider, byokApiKey } = parsed.data

    // Plan limits: free = 3 agents, pro = 20, enterprise = unlimited
    const planLimits: Record<string, number> = { free: 3, pro: 20, enterprise: 9999 }
    const limit = planLimits[auth.user.plan] ?? 3
    const existing = await db.agent.count({ where: { userId: auth.user.id } })
    if (existing >= limit) {
      return NextResponse.json(
        { error: `Your ${auth.user.plan} plan allows up to ${limit} agents. Upgrade to create more.` },
        { status: 403 }
      )
    }

    const agent = await db.agent.create({
      data: {
        userId: auth.user.id,
        name,
        description: description || '',
        systemPrompt: systemPrompt || '',
        model: model || 'deepseek-ai/deepseek-v4-flash',
        temperature: temperature ?? 0.7,
        tools: tools || [],
        avatar: avatar || null,
        byokProvider: byokProvider || null,
        byokApiKey: byokApiKey || null,
        status: 'draft',
        version: 1,
      },
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error: unknown) {
    console.error('[agents POST]', error)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
