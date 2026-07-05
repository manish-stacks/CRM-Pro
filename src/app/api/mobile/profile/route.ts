// src/app/api/mobile/profile/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'

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
