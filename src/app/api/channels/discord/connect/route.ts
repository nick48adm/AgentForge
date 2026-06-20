import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { agentId, botToken, guildId } = await req.json()
    if (!agentId || !botToken) {
      return NextResponse.json({ error: 'agentId and botToken are required' }, { status: 400 })
    }

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Validate Discord bot token
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${botToken}` },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid Discord bot token.' }, { status: 400 })
    }
    const botInfo = await res.json()

    const config = JSON.stringify({ botToken, guildId: guildId || null, botUsername: botInfo.username, botId: botInfo.id })

    await db.channel.upsert({
      where: { agentId_type: { agentId, type: 'discord' } },
      create: { agentId, type: 'discord', config, isActive: true },
      update: { config, isActive: true },
    })

    return NextResponse.json({
      success: true,
      botUsername: botInfo.username,
      message: `Discord bot @${botInfo.username} connected. Set your interactions endpoint URL to:\n${process.env.NEXT_PUBLIC_APP_URL}/api/channels/discord/webhook/${agentId}`,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/channels/discord/webhook/${agentId}`,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { agentId } = await req.json()
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    await db.channel.deleteMany({ where: { agentId, type: 'discord' } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
