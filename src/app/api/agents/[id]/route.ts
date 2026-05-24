import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { reconfigureSandbox } from '@/lib/sandbox'

const EDITABLE_FIELDS = ['name', 'description', 'systemPrompt', 'model', 'temperature', 'tools', 'avatar'] as const

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
    const updateData: any = {}

    // Whitelist — status intentionally excluded (only deploy/stop routes change it)
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt
    if (body.model !== undefined) updateData.model = body.model
    if (body.temperature !== undefined) updateData.temperature = Number(body.temperature)
    if (body.tools !== undefined) updateData.tools = JSON.stringify(body.tools)
    if (body.avatar !== undefined) updateData.avatar = body.avatar

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const agent = await db.agent.update({ where: { id }, data: updateData })

    // Hot-reload running sandbox when config changes
    if (existing.status === 'published' && existing.sandboxUrl) {
      const sandboxUpdate: any = {}
      if (updateData.systemPrompt !== undefined) sandboxUpdate.systemPrompt = updateData.systemPrompt
      if (updateData.temperature !== undefined) sandboxUpdate.temperature = updateData.temperature
      if (updateData.tools !== undefined) sandboxUpdate.tools = updateData.tools
      if (Object.keys(sandboxUpdate).length > 0) {
        reconfigureSandbox(existing.sandboxUrl, sandboxUpdate).catch(e =>
          console.error('[agent-patch] reconfigure failed:', e)
        )
      }
    }

    return NextResponse.json(agent)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
