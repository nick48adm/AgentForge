import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  try {
    const today = new Date(); today.setHours(0,0,0,0)

    const [totalUsers, totalAgents, activeAgents, todayLogs, totalRevenue] = await Promise.all([
      db.user.count(),
      db.agent.count(),
      db.agent.count({ where: { status: 'published' } }),
      db.usageLog.findMany({ where: { createdAt: { gte: today } } }),
      db.usageLog.aggregate({ _sum: { cost: true } }),
    ])

    // Get live container list from Docker
    let containers: any[] = []
    try {
      const { stdout } = await execAsync(
        `docker ps --filter "name=af-agent-" --format '{"id":"{{.ID}}","name":"{{.Names}}","status":"{{.Status}}","image":"{{.Image}}","created":"{{.CreatedAt}}"}'`
      )
      containers = stdout.trim().split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line) } catch { return null }
      }).filter(Boolean)
    } catch {}

    // Get memory/cpu stats for running containers (non-blocking)
    let containerStats: any[] = []
    if (containers.length > 0) {
      try {
        const ids = containers.map((c: any) => c.id).join(' ')
        const { stdout } = await execAsync(
          `docker stats --no-stream --format '{"id":"{{.ID}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","memPerc":"{{.MemPerc}}"}' ${ids}`
        )
        containerStats = stdout.trim().split('\n').filter(Boolean).map(line => {
          try { return JSON.parse(line) } catch { return null }
        }).filter(Boolean)
      } catch {}
    }

    // Merge stats into containers
    const enriched = containers.map((c: any) => {
      const stats = containerStats.find((s: any) => s.id === c.id.slice(0, 12) || c.id.startsWith(s.id))
      return { ...c, ...stats }
    })

    const todayCost = todayLogs.reduce((s, l) => s + l.cost, 0)
    const todayMessages = todayLogs.length
    const todayTokens = todayLogs.reduce((s, l) => s + l.tokensIn + l.tokensOut, 0)

    return NextResponse.json({
      platform: { totalUsers, totalAgents, activeAgents, todayMessages, todayTokens, todayCost: todayCost.toFixed(4), totalRevenue: (totalRevenue._sum.cost || 0).toFixed(4) },
      containers: enriched,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
