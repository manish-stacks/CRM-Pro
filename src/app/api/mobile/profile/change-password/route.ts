// src/app/api/mobile/profile/change-password/route.ts
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) return fail('currentPassword and newPassword required')
  if (newPassword.length < 6) return fail('New password must be at least 6 characters')

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return fail('User not found', 404)

  const matches = await bcrypt.compare(currentPassword, user.password)
  if (!matches) return fail('Current password is incorrect', 401)

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: session.userId }, data: { password: hashed } })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'User', entityId: session.userId,
    metadata: { via: 'mobile', action: 'change-password' },
  })

  return ok({ message: 'Password updated successfully' })
}