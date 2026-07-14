// src/app/api/mobile/profile/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session, employee } = res as any

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, phone: true, avatar: true, role: true },
  })
  if (!user) return fail('User not found', 404)

  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    image: user.avatar,
    role: user.role,
    employeeId: employee?.employeeId || null,
    department: employee?.department?.name || null,
    position: employee?.position || null,
  })
}

export async function PATCH(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { name, phone, avatar } = body

  const data: any = {}
  if (name !== undefined) {
    if (!name.trim()) return fail('Name cannot be empty')
    data.name = name.trim()
  }
  if (phone !== undefined) data.phone = phone?.trim() || null
  if (avatar !== undefined) data.avatar = avatar || null

  if (Object.keys(data).length === 0) return fail('Nothing to update')

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { id: true, name: true, email: true, phone: true, avatar: true, role: true },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'User', entityId: session.userId,
    metadata: { via: 'mobile', fields: Object.keys(data) },
  })

  return ok({ id: user.id, name: user.name, email: user.email, phone: user.phone, image: user.avatar, role: user.role })
}