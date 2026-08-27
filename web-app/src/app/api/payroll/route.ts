// src/app/api/payroll/route.ts
// List payslips - role-scoped (own for employee, team for manager, all for admin)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

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
  const search = searchParams.get('search')?.trim()

  const where: any = {}
  if (month) where.month = parseInt(month)
  if (year) where.year = parseInt(year)
  if (status) where.status = status

  const nonAdmin = ['EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE', 'MANAGER']
  if (nonAdmin.includes(session.role)) {
    const emp = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (emp) where.employeeId = emp.id
    else return successResponse([], 0)
  }

  if (employeeId && ['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    where.employeeId = employeeId
  }
  if (departmentId && ['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
    const deptEmps = await prisma.employee.findMany({ where: { departmentId }, select: { id: true } })
    where.employeeId = { in: deptEmps.map(e => e.id) }
  }

  if (search) {
    const matches = await prisma.employee.findMany({
      where: {
        OR: [
          { user: { name: { contains: search } } },
          { employeeId: { contains: search } },
        ],
      },
      select: { id: true },
    })
    const matchIds = matches.map(m => m.id)

    const existing = where.employeeId
    let existingIds: string[] | null = null
    if (typeof existing === 'string') existingIds = [existing]
    else if (existing?.in) existingIds = existing.in

    where.employeeId = { in: existingIds ? existingIds.filter(id => matchIds.includes(id)) : matchIds }
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

// DELETE /api/payroll  { ids: string[] }
// Admin-only BULK delete of payslips (also handles a single id).
// Guard: a payslip already marked PAID is never bulk-deleted — you'd be wiping
// the record of money that actually went out. Delete those one by one from the
// row action if you really mean it.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  let ids: string[] = []
  let force = false
  try {
    const body = await req.json()
    ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === 'string' && x) : []
    force = !!body?.force
  } catch {
    return errorResponse('Invalid request body')
  }
  if (ids.length === 0) return errorResponse('No payslip ids provided')

  const slips = await prisma.payslip.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, month: true, year: true, employeeId: true },
  })
  if (slips.length === 0) return errorResponse('No matching payslips found')

  const paid = slips.filter(s => s.status === 'PAID')
  const deletable = force ? slips : slips.filter(s => s.status !== 'PAID')

  if (deletable.length === 0) {
    return errorResponse('All selected payslips are already marked PAID and were not deleted')
  }

  const { count } = await prisma.payslip.deleteMany({
    where: { id: { in: deletable.map(s => s.id) } },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'Payroll',
    metadata: { count, skippedPaid: force ? 0 : paid.length, ids: deletable.map(s => s.id) },
  })

  return successResponse({
    deleted: count,
    skippedPaid: force ? 0 : paid.length,
  })
}
