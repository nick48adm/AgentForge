import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { routeChannelMessage } from '@/lib/channel-chat'
import { createVerify } from 'crypto'

// Verify Discord Ed25519 signature
function verifyDiscordSignature(body: string, signature: string, timestamp: string, publicKey: string): boolean {
  try {
    const verify = createVerify('ed25519')
    verify.update(timestamp + body)
    return verify.verify(Buffer.from(publicKey, 'hex'), Buffer.from(signature, 'hex'))
  } catch { return false }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params

    const channel = await db.channel.findUnique({ where: { agentId_type: { agentId, type: 'discord' } } })
    if (!channel || !channel.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const config = JSON.parse(String(channel.config || '{}'))
    const rawBody = await req.text()
    const signature = req.headers.get('x-signature-ed25519') || ''
    const timestamp = req.headers.get('x-signature-timestamp') || ''

    // Verify Discord signature if public key is configured
    if (config.publicKey) {
      const valid = verifyDiscordSignature(rawBody, signature, timestamp, config.publicKey)
      if (!valid) return new NextResponse('Invalid signature', { status: 401 })
    }

    const body = JSON.parse(rawBody)

    // Discord PING (required for webhook setup)
    if (body.type === 1) return NextResponse.json({ type: 1 })

    // Slash command or message interaction
    if (body.type === 2 || body.type === 3) {
      const text = body.data?.options?.[0]?.value || body.data?.name || ''
      const userId = body.member?.user?.id || body.user?.id || 'unknown'

      if (!text) return NextResponse.json({ type: 4, data: { content: 'Please provide a message.' } })

      const { content } = await routeChannelMessage({ agentId, userId, text, channel: 'discord' })

      return NextResponse.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: { content: content.slice(0, 2000) },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('[discord-webhook]', error)
    return NextResponse.json({ type: 4, data: { content: 'An error occurred.' } })
  }
}
