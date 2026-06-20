import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const kb = await db.knowledgeBase.findUnique({ where: { id }, include: { agent: true } })
    if (!kb || kb.agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Knowledge base entry not found' }, { status: 404 })
    }

    await db.knowledgeBase.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[knowledge DELETE]', error)
    return NextResponse.json({ error: 'Failed to delete knowledge base entry' }, { status: 500 })
  }
}
