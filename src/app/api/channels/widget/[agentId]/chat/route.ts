import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { routeChannelMessage } from '@/lib/channel-chat'
import { widgetLimit } from '@/lib/rate-limit'
import { widgetChatSchema } from '@/lib/validations'

// Public endpoint — called from the embeddable widget on any website
export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  // Rate limit by IP — 20 messages/minute per visitor
  const limit = widgetLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many messages. Please slow down.' }, { status: 429 })
  }

  try {
    const { agentId } = await params
    const body = await req.json()
    const parsed = widgetChatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }
    const { message, conversationId, userId } = parsed.data

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.status !== 'published') {
      return NextResponse.json({ error: 'Agent not available' }, { status: 404 })
    }

    // Get or create anonymous conversation
    let conversation = conversationId
      ? await db.conversation.findUnique({ where: { id: conversationId } })
      : null

    if (!conversation) {
      conversation = await db.conversation.create({
        data: { agentId, userId: userId || 'widget-anon', title: message.slice(0, 50), messages: [] },
      })
    }

    const { content } = await routeChannelMessage({
      agentId, userId: userId || ip, text: message, channel: 'widget',
    })

    // Persist messages
    const messages = Array.isArray(conversation.messages) ? [...conversation.messages] : []
    messages.push(
      { role: 'user', content: message, ts: new Date().toISOString() },
      { role: 'assistant', content, ts: new Date().toISOString() }
    )
    // Cap at 100 messages per widget conversation
    const cappedMessages = messages.length > 100 ? messages.slice(-100) : messages
    await db.conversation.update({ where: { id: conversation.id }, data: { messages: cappedMessages } })

    return NextResponse.json({ content, conversationId: conversation.id }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error: unknown) {
    console.error('[widget-chat]', error)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
