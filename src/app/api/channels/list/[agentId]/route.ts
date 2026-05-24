import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { agentId } = await params

  const agent = await db.agent.findUnique({ where: { id: agentId } })
  if (!agent || agent.userId !== auth.user.id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const channels = await db.channel.findMany({ where: { agentId }, orderBy: { createdAt: 'asc' } })

  // Include legacy telegram connection for backwards compat
  const tgConn = await db.telegramConnection.findUnique({ where: { agentId } })

  // Redact secrets before sending to client
  const sanitized = channels.map(ch => {
    const cfg = JSON.parse(ch.config || '{}')
    const { accessToken, botToken, ...safeCfg } = cfg
    return { ...ch, config: safeCfg }
  })

  return NextResponse.json({
    channels: sanitized,
    telegram: tgConn ? { botUsername: tgConn.botUsername, botName: tgConn.botName, isActive: tgConn.isActive } : null,
    widgetEmbedCode: agent.status === 'published'
      ? `<script src="${process.env.NEXT_PUBLIC_APP_URL}/api/channels/widget/${agentId}" async></script>`
      : null,
  })
}
