import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { agentId, botToken } = await req.json()
    if (!agentId || !botToken) {
      return NextResponse.json({ error: 'agentId and botToken are required' }, { status: 400 })
    }

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Validate token with Telegram
    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const getMeData = await getMeRes.json()
    if (!getMeData.ok) {
      return NextResponse.json({ error: 'Invalid bot token. Check your token from @BotFather.' }, { status: 400 })
    }

    const { username: botUsername, first_name: botName } = getMeData.result

    const existing = await db.telegramConnection.findUnique({ where: { agentId } })
    if (existing) {
      await db.telegramConnection.update({ where: { agentId }, data: { botToken, botUsername, botName, isActive: false } })
    } else {
      await db.telegramConnection.create({ data: { agentId, botToken, botUsername, botName, isActive: false } })
    }

    // Also upsert into Channel table for unified multi-channel tracking
    await db.channel.upsert({
      where: { agentId_type: { agentId, type: 'telegram' } },
      create: { agentId, type: 'telegram', config: JSON.stringify({ botUsername, botName }), isActive: false },
      update: { config: JSON.stringify({ botUsername, botName }) },
    })

    // Set webhook immediately if already published
    if (agent.status === 'published') {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook/${agentId}`
      const wRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      })
      if (wRes.ok) {
        await db.telegramConnection.update({ where: { agentId }, data: { webhookUrl, isActive: true } })
        await db.channel.update({ where: { agentId_type: { agentId, type: 'telegram' } }, data: { isActive: true } })
      }
    }

    return NextResponse.json({
      success: true, botUsername, botName,
      message: `Connected to @${botUsername}. ${agent.status === 'published' ? 'Webhook is active!' : 'Deploy the agent to activate the webhook.'}`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
