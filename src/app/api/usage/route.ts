import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const usageLogs = await db.usageLog.findMany({
      where: { userId: auth.user.id, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    // Daily aggregation
    const dailyMap: Record<string, { tokensIn: number; tokensOut: number; cost: number; count: number }> = {}
    for (const log of usageLogs) {
      const day = log.createdAt.toISOString().slice(0, 10)
      if (!dailyMap[day]) dailyMap[day] = { tokensIn: 0, tokensOut: 0, cost: 0, count: 0 }
      dailyMap[day].tokensIn += log.tokensIn
      dailyMap[day].tokensOut += log.tokensOut
      dailyMap[day].cost += log.cost
      dailyMap[day].count++
    }

    const agentCount = await db.agent.count({ where: { userId: auth.user.id } })
    const publishedCount = await db.agent.count({ where: { userId: auth.user.id, status: 'published' } })
    const conversationCount = await db.conversation.count({ where: { userId: auth.user.id } })

    return NextResponse.json({
      summary: {
        totalMessages: usageLogs.length,
        totalTokensIn: usageLogs.reduce((s, l) => s + l.tokensIn, 0),
        totalTokensOut: usageLogs.reduce((s, l) => s + l.tokensOut, 0),
        totalCost: usageLogs.reduce((s, l) => s + l.cost, 0),
        agentCount,
        publishedCount,
        conversationCount,
      },
      dailyUsage: dailyMap,
      recentUsage: usageLogs.slice(0, 20),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
