import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { stopSandbox } from '@/lib/sandbox'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const body = await req.json()
    const updateData: { status?: string; plan?: string } = {}
    // Admin can only toggle status
    if (body.status !== undefined && ['draft','stopped','failed'].includes(body.status)) updateData.status = body.status
    if (body.plan !== undefined && ['free','pro','enterprise'].includes(body.plan)) updateData.plan = body.plan

    const agent = await db.agent.update({ where: { id }, data: updateData as any })
    return NextResponse.json(agent)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

// Force-kill any agent's container (admin nuclear option)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    await stopSandbox(id, agent.version)
    await db.agent.update({ where: { id }, data: { status: 'stopped', containerId: null, sandboxUrl: null } })
    return NextResponse.json({ success: true, message: 'Container force-killed' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
