import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    const body = await req.json()
    const updateData: any = {}
    if (body.plan !== undefined && ['free','pro','enterprise'].includes(body.plan)) updateData.plan = body.plan
    if (body.role !== undefined && ['user','admin'].includes(body.role)) updateData.role = body.role

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    }

    const user = await db.user.update({ where: { id }, data: updateData })
    return NextResponse.json(user)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response
  const { id } = await params

  // Prevent self-deletion
  if (id === auth.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  try {
    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
