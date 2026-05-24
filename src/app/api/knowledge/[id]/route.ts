import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const { id } = await params
    const kb = await db.knowledgeBase.findUnique({ where: { id }, include: { agent: true } })
    if (!kb || kb.agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.knowledgeBase.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
