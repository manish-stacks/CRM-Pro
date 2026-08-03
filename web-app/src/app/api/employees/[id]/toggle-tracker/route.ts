// src/app/api/employees/[id]/toggle-tracker/route.ts
// Admin can exempt an individual employee from desktop-tracker check-in/out
// tracking (e.g. leadership, or someone who doesn't use the desktop app),
// without turning tracking off for everyone.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { trackerExempt } = await req.json()
  if (typeof trackerExempt !== 'boolean') return errorResponse('trackerExempt (boolean) required')

  const emp = await prisma.employee.findUnique({ where: { id } })
  if (!emp) return errorResponse('Employee not found', 404)

  const updated = await prisma.employee.update({
    where: { id },
    data: { trackerExempt },
    select: { id: true, employeeId: true, trackerExempt: true },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: trackerExempt ? 'TRACKER_EXEMPT' : 'TRACKER_UNEXEMPT',
    entityType: 'Employee',
    entityId: id,
    metadata: { employeeId: emp.employeeId },
  })

  return successResponse(updated)
}
