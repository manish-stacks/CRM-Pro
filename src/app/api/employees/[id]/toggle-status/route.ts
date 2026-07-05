// src/app/api/employees/[id]/toggle-status/route.ts
// Admin can enable/disable a user account (e.g. when employee leaves the company)
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

  const { isActive, reason } = await req.json()
  if (typeof isActive !== 'boolean') return errorResponse('isActive (boolean) required')

  // Get target employee
  const emp = await prisma.employee.findUnique({
    where: { id },
    include: { user: true },
  })
  if (!emp) return errorResponse('Employee not found', 404)

  // Safety: can't disable a SUPER_ADMIN unless you're also SUPER_ADMIN
  if (emp.user.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
    return errorResponse('Only SUPER_ADMIN can disable a super admin', 403)
  }
  // Safety: can't disable yourself
  if (emp.userId === session.userId) {
    return errorResponse('You cannot disable your own account', 403)
  }

  const updated = await prisma.user.update({
    where: { id: emp.userId },
    data: {
      isActive,
      disabledAt: isActive ? null : new Date(),
      disabledReason: isActive ? null : (reason || null),
    },
    select: { id: true, name: true, email: true, isActive: true, disabledAt: true, disabledReason: true },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: isActive ? 'ENABLE' : 'DISABLE',
    entityType: 'User',
    entityId: emp.userId,
    metadata: { employeeId: emp.employeeId, reason },
  })

  return successResponse(updated)
}
