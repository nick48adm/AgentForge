import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const kb = await db.knowledgeBase.findUnique({ where: { id }, include: { agent: true } })
    if (!kb || kb.agent.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.knowledgeBase.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
