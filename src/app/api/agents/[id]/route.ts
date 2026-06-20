import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { reconfigureSandbox } from '@/lib/sandbox'
import { updateAgentSchema } from '@/lib/validations'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        telegramConnection: true,
        knowledgeBases: true,
        _count: { select: { conversations: true, usageLogs: true } },
      },
    })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    return NextResponse.json(agent)
  } catch (error: unknown) {
    console.error('[agent GET]', error)
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing || existing.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const body = await req.json()
    const parsed = updateAgentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    const data = parsed.data
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt
    if (data.model !== undefined) updateData.model = data.model
    if (data.temperature !== undefined) updateData.temperature = data.temperature
    if (data.tools !== undefined) updateData.tools = data.tools
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.byokProvider !== undefined) updateData.byokProvider = data.byokProvider
    if (data.byokApiKey !== undefined) updateData.byokApiKey = data.byokApiKey

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const agent = await db.agent.update({ where: { id }, data: updateData })

    // Hot-reload running sandbox when config changes
    if (existing.status === 'published' && existing.sandboxUrl) {
      const sandboxUpdate: Record<string, unknown> = {}
      if (updateData.systemPrompt !== undefined) sandboxUpdate.systemPrompt = updateData.systemPrompt
      if (updateData.temperature !== undefined) sandboxUpdate.temperature = updateData.temperature
      if (updateData.tools !== undefined) sandboxUpdate.tools = JSON.stringify(updateData.tools)
      if (updateData.model !== undefined) sandboxUpdate.model = updateData.model
      if (updateData.byokProvider !== undefined) sandboxUpdate.byokProvider = updateData.byokProvider
      if (updateData.byokApiKey !== undefined) sandboxUpdate.byokApiKey = updateData.byokApiKey
      if (Object.keys(sandboxUpdate).length > 0) {
        reconfigureSandbox(existing.sandboxUrl, sandboxUpdate, existing.sandboxSecret ?? undefined).catch(e =>
          console.error('[agent-patch] reconfigure failed:', e)
        )
      }
    }

    return NextResponse.json(agent)
  } catch (error: unknown) {
    console.error('[agent PATCH]', error)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing || existing.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Stop sandbox if running
    if (existing.status === 'published' && existing.containerId) {
      const { stopSandbox } = await import('@/lib/sandbox')
      await stopSandbox(id, existing.version).catch(() => {})
    }

    await db.agent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[agent DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
  }
}
