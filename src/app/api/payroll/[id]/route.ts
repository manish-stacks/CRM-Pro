import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

// NOTE: The Payslip model has no `allowances` / `deductions` columns — earnings are
// split into basicSalary/hra/conveyance/medical/specialAllow/otherEarnings, and
// deductions into pf/esi/tds/professionTax/otherDeduct (totalDeduct = sum of the
// statutory four). Admin manual adjustments map to otherEarnings / otherDeduct.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const { allowances, deductions, status } = await req.json()
  const ps = await prisma.payslip.findUnique({ where: { id: id } })
  if (!ps) return errorResponse('Not found', 404)

  const otherEarnings = allowances !== undefined ? Number(allowances) : ps.otherEarnings
  const otherDeduct = deductions !== undefined ? Number(deductions) : ps.otherDeduct

  // grossSalary already holds attendance-prorated gross (basic+hra+conveyance+medical+specialAllow)
  // totalDeduct holds the statutory deductions (pf+esi+tds+professionTax)
  const newNet = ps.grossSalary + otherEarnings - ps.totalDeduct - otherDeduct

  const updated = await prisma.payslip.update({
    where: { id: id },
    data: {
      otherEarnings,
      otherDeduct,
      netSalary: Math.max(0, newNet),
      status: status || ps.status,
      paidAt: status === 'PAID' && ps.status !== 'PAID' ? new Date() : ps.paidAt,
    },
  })
  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  await prisma.payslip.delete({ where: { id: id } })
  return successResponse({ deleted: true })
}