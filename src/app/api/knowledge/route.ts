import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

const MAX_CONTENT_LENGTH = 500_000 // 500KB per file

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { agentId, fileName, fileType, content } = await req.json()

    if (!agentId || !fileName || !content) {
      return NextResponse.json({ error: 'agentId, fileName, and content are required' }, { status: 400 })
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: 'File content too large (max 500KB)' }, { status: 413 })
    }

    const agent = await db.agent.findUnique({ where: { id: agentId } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const kb = await db.knowledgeBase.create({
      data: {
        agentId,
        fileName: fileName.slice(0, 255),
        fileType: fileType || 'text',
        content,
        vectorNamespace: `user_${auth.user.id}_agent_${agentId}`,
      },
    })

    return NextResponse.json(kb, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
