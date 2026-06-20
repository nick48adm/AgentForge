/**
 * session.ts
 * Centralised server-side session helper.
 * Replaces the insecure x-user-id header pattern everywhere.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextResponse } from 'next/server'

export interface AuthUser {
  id: string
  role: string
  plan: string
  email?: string | null
  name?: string | null
}

/**
 * Validate session from a Next.js route handler.
 * Returns { user } on success, { response } (401) on failure.
 */
export async function requireAuth(): Promise<
  { user: AuthUser; response?: never } | { user?: never; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return {
    user: {
      id: session.user.id,
      role: session.user.role ?? 'user',
      plan: session.user.plan ?? 'free',
      email: session.user.email,
      name: session.user.name,
    },
  }
}

/**
 * Same as requireAuth but also checks role === 'admin'.
 */
export async function requireAdmin(): Promise<
  { user: AuthUser; response?: never } | { user?: never; response: NextResponse }
> {
  const result = await requireAuth()
  if (result.response) return result
  if (result.user.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}
