import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { verifyPassword, hashPassword } from '@/lib/crypto'
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'Password too long'),
})

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const parsed = passwordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = parsed.data

    const user = await db.user.findUnique({ where: { id: auth.user.id } })
    if (!user || !user.password) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }

    // Hash and update
    const hashed = await hashPassword(newPassword)
    await db.user.update({ where: { id: auth.user.id }, data: { password: hashed } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[password PATCH]', error)
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
