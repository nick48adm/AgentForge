import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { routeChannelMessage } from '@/lib/channel-chat'

// GET — Meta webhook verification challenge
export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  const channel = await db.channel.findUnique({ where: { agentId_type: { agentId, type: 'whatsapp' } } })
  if (!channel) return new NextResponse('Not found', { status: 404 })

  const config = JSON.parse(String(channel.config || '{}'))
  if (mode === 'subscribe' && token === config.verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST — Incoming WhatsApp message
export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params
    const body = await req.json()

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const messageObj = changes?.value?.messages?.[0]

    if (!messageObj || messageObj.type !== 'text') return NextResponse.json({ success: true })

    const fromPhone = messageObj.from
    const text: string = messageObj.text.body

    const channel = await db.channel.findUnique({ where: { agentId_type: { agentId, type: 'whatsapp' } } })
    if (!channel || !channel.isActive) return NextResponse.json({ success: true })

    const config = JSON.parse(String(channel.config || '{}'))

    const { content } = await routeChannelMessage({ agentId, userId: fromPhone, text, channel: 'whatsapp' })

    // Send reply via WhatsApp Cloud API
    await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: fromPhone,
        type: 'text',
        text: { body: content.slice(0, 4096) },
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[whatsapp-webhook]', error)
    return NextResponse.json({ success: true })
  }
}
