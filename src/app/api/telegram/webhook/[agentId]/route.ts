import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { routeChannelMessage } from '@/lib/channel-chat'

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params
    const update = await req.json()

    const message = update.message || update.edited_message
    if (!message?.text) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const text: string = message.text
    const fromUserId = String(message.from?.id || chatId)

    const connection = await db.telegramConnection.findUnique({
      where: { agentId },
      include: { agent: true },
    })

    if (!connection || !connection.isActive) return NextResponse.json({ ok: true })

    // Allowlist check
    const allowedUsers: string[] = JSON.parse(connection.allowedUsers || '[]')
    if (allowedUsers.length > 0 && !allowedUsers.includes(fromUserId)) {
      await tgSend(connection.botToken, chatId, 'You are not authorised to use this bot.')
      return NextResponse.json({ ok: true })
    }

    // /start command
    if (text === '/start') {
      const agent = connection.agent
      await tgSend(connection.botToken, chatId,
        `Hi! I'm *${agent.name}*.\n${agent.description || 'How can I help you today?'}\n\nJust send me a message!`
      )
      return NextResponse.json({ ok: true })
    }

    const { content } = await routeChannelMessage({
      agentId, userId: fromUserId, text, channel: 'telegram',
    })

    await tgSend(connection.botToken, chatId, content)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[telegram-webhook]', error)
    return NextResponse.json({ ok: true })
  }
}

async function tgSend(token: string, chatId: number, text: string) {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += 4096) chunks.push(text.slice(i, i + 4096))
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'Markdown' }),
    }).catch(e => console.error('[tgSend]', e))
  }
}
