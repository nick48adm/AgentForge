/**
 * Legacy webhook route — redirects to per-agent webhook.
 * Kept for backwards compatibility. New installs use /api/telegram/webhook/[agentId]
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Each agent now has its own webhook URL: /api/telegram/webhook/[agentId]' },
    { status: 410 }
  )
}
