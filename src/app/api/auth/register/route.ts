import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'
import { authLimit } from '@/lib/rate-limit'
import { registerSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const limit = authLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }
    const { email, password, name } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashed = await hashPassword(password)
    const user = await db.user.create({
      data: {
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: hashed,
        role: 'user',
        plan: 'free',
      },
    })

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan })
  } catch (error: unknown) {
    console.error('[register]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
