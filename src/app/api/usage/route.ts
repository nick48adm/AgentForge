import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Use SQL-level aggregation for better performance
    const [dailyAgg, summaryAgg, agentCount, publishedCount, conversationCount, recentLogs] = await Promise.all([
      db.usageLog.groupBy({
        by: ['createdAt'],
        where: { userId: auth.user.id, createdAt: { gte: thirtyDaysAgo } },
        _sum: { tokensIn: true, tokensOut: true, cost: true },
        _count: true,
      }),
      db.usageLog.aggregate({
        where: { userId: auth.user.id, createdAt: { gte: thirtyDaysAgo } },
        _sum: { tokensIn: true, tokensOut: true, cost: true },
        _count: true,
      }),
      db.agent.count({ where: { userId: auth.user.id } }),
      db.agent.count({ where: { userId: auth.user.id, status: 'published' } }),
      db.conversation.count({ where: { userId: auth.user.id } }),
      db.usageLog.findMany({
        where: { userId: auth.user.id, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    // Build daily map from grouped results
    const dailyMap: Record<string, { tokensIn: number; tokensOut: number; cost: number; count: number }> = {}
    for (const row of dailyAgg) {
      const day = row.createdAt.toISOString().slice(0, 10)
      if (!dailyMap[day]) dailyMap[day] = { tokensIn: 0, tokensOut: 0, cost: 0, count: 0 }
      dailyMap[day].tokensIn += row._sum.tokensIn || 0
      dailyMap[day].tokensOut += row._sum.tokensOut || 0
      dailyMap[day].cost += row._sum.cost || 0
      dailyMap[day].count += row._count
    }

    return NextResponse.json({
      summary: {
        totalMessages: summaryAgg._count,
        totalTokensIn: summaryAgg._sum.tokensIn || 0,
        totalTokensOut: summaryAgg._sum.tokensOut || 0,
        totalCost: summaryAgg._sum.cost || 0,
        agentCount,
        publishedCount,
        conversationCount,
      },
      dailyUsage: dailyMap,
      recentUsage: recentLogs,
    })
  } catch (error: unknown) {
    console.error('[usage]', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}
