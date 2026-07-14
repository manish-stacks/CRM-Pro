// src/app/api/users/by-role/route.ts
// Filter users by role — used for reassign dropdowns
// e.g. /api/users/by-role?role=TELECALLER
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const roles = searchParams.get('roles') // comma-separated list

  const where: any = { isActive: true }
  if (roles) {
    const arr = roles.split(',').filter(r => VALID_ROLES.includes(r))
    if (arr.length) where.role = { in: arr }
  } else if (role && VALID_ROLES.includes(role)) {
    where.role = role
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, phone: true, role: true, avatar: true,
      employee: {
        select: {
          employeeId: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  return successResponse(users, users.length)
}
