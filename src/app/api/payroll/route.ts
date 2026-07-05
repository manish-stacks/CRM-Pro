// src/app/api/payroll/route.ts
// List payslips - role-scoped (own for employee, team for manager, all for admin)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, getPaginationParams } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const month = searchParams.get('month')
  const year = searchParams.get('year')
  const status = searchParams.get('status')
  const employeeId = searchParams.get('employeeId')
  const departmentId = searchParams.get('departmentId')

  const where: any = {}
  if (month) where.month = parseInt(month)
  if (year) where.year = parseInt(year)
  if (status) where.status = status

  const nonAdmin = ['EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']
  if (nonAdmin.includes(session.role)) {
    const emp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (emp) where.employeeId = emp.id
    else return successResponse([], 0)
  } else if (session.role === 'MANAGER') {
    const managerEmp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (managerEmp) {
      const managedDepts = await prisma.department.findMany({
        where: { managerId: managerEmp.id },
        select: { id: true },
      })
      const deptEmps = managedDepts.length
        ? await prisma.employee.findMany({ where: { departmentId: { in: managedDepts.map(d => d.id) } }, select: { id: true } })
        : []
      const allowed = new Set([managerEmp.id, ...deptEmps.map(e => e.id)])
      where.employeeId = { in: Array.from(allowed) }
    }
  }

  if (employeeId && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
    where.employeeId = employeeId
  }
  if (departmentId && ['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    const deptEmps = await prisma.employee.findMany({ where: { departmentId }, select: { id: true } })
    where.employeeId = { in: deptEmps.map(e => e.id) }
  }

  const [payslips, total] = await Promise.all([
    prisma.payslip.findMany({
      where, skip, take: limit,
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true, avatar: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.payslip.count({ where }),
  ])
  return successResponse(payslips, total)
}
