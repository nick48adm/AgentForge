import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { agentId } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 })

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const connection = await db.telegramConnection.findUnique({ where: { agentId } })
    if (!connection) return NextResponse.json({ error: 'No Telegram connection found' }, { status: 404 })

    await fetch(`https://api.telegram.org/bot${connection.botToken}/deleteWebhook`, { method: 'POST' }).catch(() => {})
    await db.telegramConnection.delete({ where: { agentId } })
    await db.channel.deleteMany({ where: { agentId, type: 'telegram' } })

    return NextResponse.json({ success: true, message: 'Telegram bot disconnected' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
