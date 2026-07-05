// src/app/api/client-portal/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { compare, hash } from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current_password, new_password, currentPassword, newPassword } = await req.json()
  const curr = current_password || currentPassword
  const next = new_password || newPassword

  if (!curr || !next) return NextResponse.json({ error: 'Both current and new password required' }, { status: 400 })
  if (String(next).length < 6) return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })

  const client = await prisma.client.findUnique({ where: { id: session.clientId } })
  if (!client?.portalPassword) return NextResponse.json({ error: 'Portal not activated' }, { status: 400 })

  const ok = await compare(curr, client.portalPassword)
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hashed = await hash(next, 10)
  await prisma.client.update({
    where: { id: session.clientId },
    data: { portalPassword: hashed, portalPasswordSet: true },
  })

  return NextResponse.json({ success: true, message: 'Password changed successfully' })
}
