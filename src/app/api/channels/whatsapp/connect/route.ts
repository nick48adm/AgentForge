import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { agentId, phoneNumberId, accessToken, verifyToken } = await req.json()
    if (!agentId || !phoneNumberId || !accessToken || !verifyToken) {
      return NextResponse.json({ error: 'agentId, phoneNumberId, accessToken, and verifyToken are required' }, { status: 400 })
    }

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Validate with Meta API
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Invalid WhatsApp credentials. Check your phone number ID and access token.' }, { status: 400 })
    }
    const waInfo = await res.json()

    const config = JSON.stringify({ phoneNumberId, accessToken, verifyToken, displayPhone: waInfo.display_phone_number })

    await db.channel.upsert({
      where: { agentId_type: { agentId, type: 'whatsapp' } },
      create: { agentId, type: 'whatsapp', config, isActive: true },
      update: { config, isActive: true },
    })

    return NextResponse.json({
      success: true,
      message: `WhatsApp connected (${waInfo.display_phone_number}). Set your webhook URL to:\n${process.env.NEXT_PUBLIC_APP_URL}/api/channels/whatsapp/webhook/${agentId}`,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/channels/whatsapp/webhook/${agentId}`,
      verifyToken,
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
    await db.channel.deleteMany({ where: { agentId, type: 'whatsapp' } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
