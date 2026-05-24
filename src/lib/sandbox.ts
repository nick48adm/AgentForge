/**
 * sandbox.ts
 * Manages Docker containers for agent sandboxing.
 * Each agent gets its own isolated container — filesystem, network, resources.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { randomBytes } from 'crypto'

const execAsync = promisify(exec)

const SANDBOX_LIMITS = { memory: '256m', cpus: '0.5', pidsLimit: 100 }
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || 'agentforge-sandbox:latest'
const SANDBOX_NETWORK = process.env.SANDBOX_NETWORK || 'agentforge-sandbox-net'
const SANDBOX_WORKSPACE_ROOT = process.env.SANDBOX_WORKSPACE_ROOT || '/var/agentforge/workspaces'
const INTERNAL_PORT = 8080

export interface SandboxInfo {
  containerId: string
  containerName: string
  sandboxUrl: string
}

export function containerName(agentId: string, version: number): string {
  return `af-agent-${agentId.slice(0, 12)}-v${version}`
}

export async function ensureNetwork(): Promise<void> {
  try {
    await execAsync(`docker network inspect ${SANDBOX_NETWORK}`)
  } catch {
    await execAsync(`docker network create --driver bridge --internal ${SANDBOX_NETWORK}`)
    console.log(`[sandbox] Created network: ${SANDBOX_NETWORK}`)
  }
}

export async function ensureSandboxImage(): Promise<void> {
  try {
    await execAsync(`docker image inspect ${SANDBOX_IMAGE}`)
  } catch {
    const { execSync } = await import('child_process')
    const dockerfilePath = require('path').join(process.cwd(), 'sandbox-agent')
    execSync(`docker build -t ${SANDBOX_IMAGE} ${dockerfilePath}`, { stdio: 'inherit' })
  }
}

function esc(val: string): string {
  return `'${val.replace(/'/g, "'\\''")}'`
}

export async function startSandbox(
  agentId: string,
  version: number,
  agentConfig: { name: string; systemPrompt: string; model: string; temperature: number; tools: string }
): Promise<SandboxInfo> {
  await ensureNetwork()
  await ensureSandboxImage()

  const name = containerName(agentId, version)
  const workspaceDir = `${SANDBOX_WORKSPACE_ROOT}/${agentId}`
  await execAsync(`mkdir -p ${workspaceDir}`)
  await execAsync(`docker rm -f ${name}`).catch(() => {})

  // Per-container secret — prevents anything else on the sandbox network from calling /chat
  const sandboxSecret = randomBytes(32).toString('hex')

  const envFlags = [
    `-e AGENT_ID=${agentId}`,
    `-e AGENT_NAME=${esc(agentConfig.name)}`,
    `-e AGENT_SYSTEM_PROMPT=${esc(agentConfig.systemPrompt)}`,
    `-e AGENT_MODEL=${agentConfig.model}`,
    `-e AGENT_TEMPERATURE=${agentConfig.temperature}`,
    `-e AGENT_TOOLS=${esc(agentConfig.tools)}`,
    `-e INTERNAL_PORT=${INTERNAL_PORT}`,
    `-e SANDBOX_SECRET=${sandboxSecret}`,
    `-e GROQ_API_KEY=${process.env.GROQ_API_KEY || ''}`,
    `-e NVIDIA_NIM_API_KEY=${process.env.NVIDIA_NIM_API_KEY || ''}`,
    `-e OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ''}`,
    `-e SERPAPI_KEY=${process.env.SERPAPI_KEY || ''}`,
    `-e BRAVE_SEARCH_KEY=${process.env.BRAVE_SEARCH_KEY || ''}`,
  ]

  const cmd = [
    'docker run -d',
    `--name ${name}`,
    `--network ${SANDBOX_NETWORK}`,
    `--memory ${SANDBOX_LIMITS.memory}`,
    `--cpus ${SANDBOX_LIMITS.cpus}`,
    `--pids-limit ${SANDBOX_LIMITS.pidsLimit}`,
    '--restart unless-stopped',
    '--security-opt no-new-privileges',
    '--cap-drop ALL',
    '--cap-add NET_BIND_SERVICE',
    '--read-only',
    '--tmpfs /tmp:rw,noexec,nosuid,size=64m',
    `--volume ${workspaceDir}:/workspace:rw`,
    `--expose ${INTERNAL_PORT}`,
    ...envFlags,
    SANDBOX_IMAGE,
  ].join(' ')

  const { stdout } = await execAsync(cmd)
  const containerId = stdout.trim()

  // Store secret in DB so the app can use it when proxying
  const { db } = await import('./db')
  await db.agent.update({ where: { id: agentId }, data: { sandboxSecret } as any }).catch(() => {})

  return { containerId, containerName: name, sandboxUrl: `http://${name}:${INTERNAL_PORT}` }
}

export async function stopSandbox(agentId: string, version?: number): Promise<void> {
  if (version !== undefined) {
    await execAsync(`docker rm -f ${containerName(agentId, version)}`).catch(() => {})
    return
  }
  const { stdout } = await execAsync(
    `docker ps -a --filter "name=af-agent-${agentId.slice(0, 12)}" --format "{{.Names}}"`
  ).catch(() => ({ stdout: '' }))
  for (const n of stdout.trim().split('\n').filter(Boolean)) {
    await execAsync(`docker rm -f ${n}`).catch(() => {})
  }
}

export async function getSandboxStatus(cname: string): Promise<'running' | 'stopped' | 'error'> {
  try {
    const { stdout } = await execAsync(`docker inspect --format '{{.State.Status}}' ${cname}`)
    return stdout.trim() === 'running' ? 'running' : 'stopped'
  } catch { return 'error' }
}

export async function proxyChatToSandbox(
  sandboxUrl: string,
  payload: { message: string; conversationHistory: any[]; userId: string },
  secret?: string
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  const res = await fetch(`${sandboxUrl}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) throw new Error(`Sandbox error (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function reconfigureSandbox(
  sandboxUrl: string,
  config: { systemPrompt?: string; temperature?: number; tools?: string },
  secret?: string
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  const res = await fetch(`${sandboxUrl}/_admin/reconfigure`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(config),
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Reconfigure failed: ${await res.text()}`)
}

export async function getSandboxLogs(cname: string, tail = 100): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`docker logs --tail ${tail} ${cname} 2>&1`)
    return (stdout + stderr).slice(0, 20000)
  } catch { return '' }
}
