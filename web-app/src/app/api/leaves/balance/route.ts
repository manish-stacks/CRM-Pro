// src/app/api/leaves/balance/route.ts
// GET /api/leaves/balance            -> current user's leave balance
// GET /api/leaves/balance?employeeId= -> a specific employee (admin/manager only)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { computeLeaveBalance } from '@/lib/leaveBalance'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const reqEmployeeId = searchParams.get('employeeId')

  // Resolve which employee to compute for
  let employee
  if (reqEmployeeId && hasMinRole(session.role, 'MANAGER')) {
    employee = await prisma.employee.findUnique({
      where: { id: reqEmployeeId },
      select: { id: true, joiningDate: true, user: { select: { name: true } } },
    })
  } else {
    employee = await prisma.employee.findFirst({
      where: { userId: session.userId },
      select: { id: true, joiningDate: true, user: { select: { name: true } } },
    })
  }
  if (!employee) return errorResponse('Employee not found', 404)

  const leaves = await prisma.leave.findMany({
    where: { employeeId: employee.id },
    select: { leaveType: true, status: true, days: true, startDate: true },
  })

  const balance = await computeLeaveBalance(employee.joiningDate, leaves)

  return successResponse({
    employeeId: employee.id,
    name: employee.user?.name,
    joiningDate: employee.joiningDate,
    ...balance,
  })
}