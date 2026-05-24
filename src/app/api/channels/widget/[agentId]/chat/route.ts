import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { routeChannelMessage } from '@/lib/channel-chat'
import { rateLimit } from '@/lib/rate-limit'

// Public endpoint — called from the embeddable widget on any website
export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  // Rate limit by IP — 20 messages/minute per visitor
  const limit = rateLimit(`widget:${ip}`, 20, 60_000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many messages. Please slow down.' }, { status: 429 })
  }

  try {
    const { agentId } = await params
    const { message, conversationId, userId } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }

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
        data: { agentId, userId: userId || 'widget-anon', title: message.slice(0, 50), messages: JSON.stringify([]) },
      })
    }

    const { content } = await routeChannelMessage({
      agentId, userId: userId || ip, text: message.trim(), channel: 'widget',
    })

    // Persist messages
    const messages = JSON.parse(conversation.messages || '[]')
    messages.push(
      { role: 'user', content: message, ts: new Date().toISOString() },
      { role: 'assistant', content, ts: new Date().toISOString() }
    )
    if (messages.length > 100) messages.splice(0, messages.length - 100)
    await db.conversation.update({ where: { id: conversation.id }, data: { messages: JSON.stringify(messages) } })

    return NextResponse.json({ content, conversationId: conversation.id }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error: any) {
    console.error('[widget-chat]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
