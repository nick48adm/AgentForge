import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { stopSandbox } from '@/lib/sandbox'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    await stopSandbox(id, agent.version)

    const tc = await db.telegramConnection.findUnique({ where: { agentId: id } })
    if (tc?.botToken && tc.isActive) {
      await fetch(`https://api.telegram.org/bot${tc.botToken}/deleteWebhook`, { method: 'POST' }).catch(() => {})
      await db.telegramConnection.update({ where: { agentId: id }, data: { isActive: false, webhookUrl: null } })
    }

    await db.agent.update({ where: { id }, data: { status: 'stopped', containerId: null, sandboxUrl: null } })
    return NextResponse.json({ success: true, message: 'Agent stopped and container removed' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
