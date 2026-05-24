import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, isLegacyPlaintext, hashPassword } from '@/lib/crypto'
import { authLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const limit = authLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email } })
    // Generic error — don't reveal whether email exists
    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    let valid = false
    if (isLegacyPlaintext(user.password)) {
      valid = user.password === password
      if (valid) {
        const hashed = await hashPassword(password)
        await db.user.update({ where: { id: user.id }, data: { password: hashed } })
      }
    } else {
      valid = await verifyPassword(password, user.password)
    }

    if (!valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, image: user.image })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
