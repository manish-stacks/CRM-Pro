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

  const headOfRole = searchParams.get('headOfRole') // e.g. TELECALLER, MARKETING_EXECUTIVE — narrows MANAGER results to actual heads of that team

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

  if (headOfRole && VALID_ROLES.includes(headOfRole)) {
    const managers = users.filter(u => u.role === 'MANAGER')
    if (managers.length) {
      // A MANAGER only stays in the list if the department they head actually
      // contains at least one user with `headOfRole` — otherwise every
      // department's head (HR, Dev, Design...) would show up in, say, the
      // Telecaller picker just because they're a MANAGER somewhere.
      const managerEmployees = await prisma.employee.findMany({
        where: { userId: { in: managers.map(m => m.id) } },
        select: { id: true, userId: true },
      })
      const empIdToUserId = new Map(managerEmployees.map(e => [e.id, e.userId]))
      const headedDepts = await prisma.department.findMany({
        where: { managerId: { in: managerEmployees.map(e => e.id) } },
        select: { id: true, managerId: true },
      })
      const deptEmpsWithRole = await prisma.employee.findMany({
        where: { departmentId: { in: headedDepts.map(d => d.id) }, user: { role: headOfRole } },
        select: { departmentId: true },
      })
      const deptsWithRole = new Set(deptEmpsWithRole.map(e => e.departmentId))
      const validManagerUserIds = new Set(
        headedDepts.filter(d => deptsWithRole.has(d.id)).map(d => empIdToUserId.get(d.managerId!)).filter(Boolean)
      )
      return successResponse(
        users.filter(u => u.role !== 'MANAGER' || validManagerUserIds.has(u.id))
      )
    }
  }

  return successResponse(users, users.length)
}
