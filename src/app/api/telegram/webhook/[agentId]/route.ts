import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { routeChannelMessage } from '@/lib/channel-chat'

// Telegram Bot API secret token validation
// Set TELEGRAM_WEBHOOK_SECRET env var to validate incoming webhooks
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params

    // Validate Telegram webhook secret if configured
    if (TELEGRAM_WEBHOOK_SECRET) {
      const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
      if (secretToken !== TELEGRAM_WEBHOOK_SECRET) {
        // Return ok to prevent Telegram from retrying, but don't process
        return NextResponse.json({ ok: true })
      }
    }

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
    const allowedUsers: string[] = Array.isArray(connection.allowedUsers)
      ? connection.allowedUsers as string[]
      : JSON.parse((connection.allowedUsers as string) || '[]')
    if (allowedUsers.length > 0 && !allowedUsers.includes(fromUserId)) {
      await tgSend(connection.botToken, chatId, 'You are not authorised to use this bot.')
      return NextResponse.json({ ok: true })
    }

    // /start command
    if (text === '/start') {
      const agent = connection.agent
      await tgSend(connection.botToken, chatId,
        `Hi! I'm *${escapeMarkdown(agent.name)}*.\n${agent.description || 'How can I help you today?'}\n\nJust send me a message!`
      )
      return NextResponse.json({ ok: true })
    }

    const { content } = await routeChannelMessage({
      agentId, userId: fromUserId, text, channel: 'telegram',
    })

    await tgSend(connection.botToken, chatId, content)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('[telegram-webhook]', error)
    // Return ok to prevent Telegram from retrying
    return NextResponse.json({ ok: true })
  }
}

/**
 * Escape special Markdown characters for Telegram's MarkdownV2 parse mode.
 * Falls back to plain text if escaping is complex.
 */
function escapeMarkdown(text: string): string {
  // Simple escaping for common Markdown characters
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

async function tgSend(token: string, chatId: number, text: string) {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += 4096) chunks.push(text.slice(i, i + 4096))
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
      // Removed parse_mode: 'Markdown' to avoid formatting errors with AI responses
      // Use MarkdownV2 with proper escaping when needed
    }).catch(e => console.error('[tgSend]', e))
  }
}
