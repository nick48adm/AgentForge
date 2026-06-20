import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
})

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.response) return auth.response

  try {
    const body = await req.json()
    const parsed = profileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { name } = parsed.data
    const user = await db.user.update({
      where: { id: auth.user.id },
      data: { name },
      select: { id: true, name: true, email: true, role: true, plan: true },
    })

    return NextResponse.json(user)
  } catch (error: unknown) {
    console.error('[profile PATCH]', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
