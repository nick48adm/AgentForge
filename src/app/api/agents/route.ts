import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const { name, description, systemPrompt, model, temperature, tools, avatar } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 })
    }

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
        name: name.trim(),
        description: description || '',
        systemPrompt: systemPrompt || '',
        model: model || 'llama-3.3-70b-versatile',
        temperature: temperature ?? 0.7,
        tools: JSON.stringify(tools || []),
        avatar: avatar || null,
        status: 'draft',
        version: 1,
      },
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
