import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, isLegacyPlaintext, hashPassword } from '@/lib/crypto'
import { authLimit } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const limit = authLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }
    const { email, password } = parsed.data

    const user = await db.user.findUnique({ where: { email } })
    // Generic error — don't reveal whether email exists
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    let valid = false
    if (isLegacyPlaintext(user.password)) {
      // Use constant-time comparison for legacy plaintext passwords
      const a = Buffer.from(user.password)
      const b = Buffer.from(password)
      if (a.length === b.length) {
        valid = Buffer.compare(a, b) === 0
      }
      if (valid) {
        const hashed = await hashPassword(password)
        await db.user.update({ where: { id: user.id }, data: { password: hashed } })
      }
    } else {
      valid = await verifyPassword(password, user.password)
    }

    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, image: user.image })
  } catch (error: unknown) {
    console.error('[login]', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
