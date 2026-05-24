import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  try {
    const agents = await db.agent.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        telegramConnection: true,
        channels: true,
        _count: { select: { conversations: true, usageLogs: true } },
      },
    })
    return NextResponse.json(agents)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
