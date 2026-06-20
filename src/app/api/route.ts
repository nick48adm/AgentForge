import { NextResponse } from 'next/server'
import { version } from '@/../package.json'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AgentForge',
    version,
    timestamp: new Date().toISOString(),
  })
}
