import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { knowledgeSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const parsed = knowledgeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }
    const { agentId, fileName, fileType, content } = parsed.data

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const kb = await db.knowledgeBase.create({
      data: {
        agentId,
        fileName,
        fileType: fileType || 'text',
        content,
        vectorNamespace: `user_${auth.user.id}_agent_${agentId}`,
      },
    })

    return NextResponse.json(kb, { status: 201 })
  } catch (error: unknown) {
    console.error('[knowledge POST]', error)
    return NextResponse.json({ error: 'Failed to create knowledge base entry' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const agentId = req.nextUrl.searchParams.get('agentId')
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    // Verify ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const kbs = await db.knowledgeBase.findMany({ where: { agentId }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(kbs)
  } catch (error: unknown) {
    console.error('[knowledge GET]', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 })
  }
}
