import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { startSandbox, stopSandbox, getSandboxLogs, containerName } from '@/lib/sandbox'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const agent = await db.agent.findUnique({
      where: { id },
      include: { telegramConnection: true },
    })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.status === 'deploying') {
      return NextResponse.json({ error: 'Deployment already in progress' }, { status: 409 })
    }

    const newVersion = agent.version + 1
    const deployJob = await db.deployJob.create({
      data: { agentId: id, status: 'queued', version: newVersion, logs: 'Deploy job queued…\n' },
    })

    await db.agent.update({ where: { id }, data: { status: 'deploying', version: newVersion } })

    // Fire-and-forget real deploy
    runDeploy(agent, deployJob.id, newVersion)

    return NextResponse.json({ jobId: deployJob.id, status: 'queued', version: newVersion, message: 'Deployment started' })
  } catch (error: unknown) {
    console.error('[deploy POST]', error)
    return NextResponse.json({ error: 'Failed to start deployment' }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.response) return auth.response
  const { id } = await params
  const jobId = req.nextUrl.searchParams.get('jobId')

  try {
    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent || agent.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const job = jobId
      ? await db.deployJob.findUnique({ where: { id: jobId } })
      : await db.deployJob.findFirst({ where: { agentId: id }, orderBy: { createdAt: 'desc' } })

    if (!job) return NextResponse.json({ error: 'No deploy job found' }, { status: 404 })

    let liveLogs = job.logs
    if (agent.containerId) {
      const cname = containerName(id, agent.version)
      const dockerLogs = await getSandboxLogs(cname, 50)
      if (dockerLogs) liveLogs += `\n--- Container logs ---\n${dockerLogs}`
    }

    return NextResponse.json({ ...job, logs: liveLogs })
  } catch (error: unknown) {
    console.error('[deploy GET]', error)
    return NextResponse.json({ error: 'Failed to fetch deploy status' }, { status: 500 })
  }
}

interface AgentWithTelegram {
  id: string
  name: string
  systemPrompt: string
  model: string
  temperature: number
  tools: unknown
  version: number
  byokProvider?: string | null
  byokApiKey?: string | null
  telegramConnection?: { botToken: string } | null
}

async function runDeploy(agent: AgentWithTelegram, jobId: string, version: number) {
  const agentId = agent.id
  const appendLog = async (status: string, logs: string) => {
    await db.deployJob.update({ where: { id: jobId }, data: { status, logs } }).catch(console.error)
  }

  try {
    await appendLog('building', 'Stopping previous sandbox (if any)…\n')
    await stopSandbox(agentId, version - 1).catch(() => {})

    await appendLog('building', 'Stopping previous sandbox (if any)… done\nStarting isolated sandbox container…\n')
    const sandbox = await startSandbox(agentId, version, {
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
      tools: typeof agent.tools === 'string' ? agent.tools : JSON.stringify(agent.tools),
      byokProvider: agent.byokProvider,
      byokApiKey: agent.byokApiKey,
    })

    await appendLog('deploying', 'Container started. Running health checks…\n')

    let healthy = false
    for (let i = 0; i < 15; i++) {
      await sleep(2000)
      try {
        const res = await fetch(`${sandbox.sandboxUrl}/_health`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) { healthy = true; break }
      } catch {}
    }

    if (!healthy) {
      const dockerLogs = await getSandboxLogs(sandbox.containerName, 40)
      await appendLog('failed', `Health check failed after 30s.\n\nContainer logs:\n${dockerLogs}`)
      await db.agent.update({ where: { id: agentId }, data: { status: 'draft' } })
      return
    }

    await db.agent.update({
      where: { id: agentId },
      data: { status: 'published', containerId: sandbox.containerId, sandboxUrl: sandbox.sandboxUrl, publishedAt: new Date() },
    })

    await appendLog('completed', 'Container healthy.\nSandbox deployed successfully!\n')

    // Telegram webhook
    if (agent.telegramConnection?.botToken) {
      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook/${agentId}`
        const r = await fetch(`https://api.telegram.org/bot${agent.telegramConnection.botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        })
        if (r.ok) {
          await db.telegramConnection.update({ where: { agentId }, data: { webhookUrl, isActive: true } })
        }
      } catch (e) {
        console.error('[deploy] Telegram webhook error:', e)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown deployment error'
    console.error('[deploy]', message)
    await db.deployJob.update({ where: { id: jobId }, data: { status: 'failed', logs: `Deployment error: ${message}` } }).catch(() => {})
    await db.agent.update({ where: { id: agentId }, data: { status: 'draft' } }).catch(() => {})
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
