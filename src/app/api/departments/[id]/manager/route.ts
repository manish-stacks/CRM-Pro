// src/app/api/departments/[id]/manager/route.ts
// Change department manager. Records history entry with reason.
// Effects: manager immediately gets visibility over the dept's employees'
// leaves, attendance and clients (handled at each API's role-check layer).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { managerId, reason } = await req.json()
  // managerId can be null to unassign

  const dept = await prisma.department.findUnique({ where: { id } })
  if (!dept) return notFoundResponse('Department')

  // Verify new manager is a valid employee (if provided)
  if (managerId) {
    const emp = await prisma.employee.findUnique({
      where: { id: managerId },
      include: { user: { select: { role: true, isActive: true } } },
    })
    if (!emp) return errorResponse('Manager employee not found', 404)
    if (!emp.user.isActive) return errorResponse('Cannot assign disabled user as manager')
  }

  const oldManagerId = dept.managerId

  // Close prior history entry
  if (oldManagerId) {
    await prisma.departmentManagerHistory.updateMany({
      where: { departmentId: id, managerId: oldManagerId, removedAt: null },
      data: { removedAt: new Date() },
    })
  }

  // Update department + insert new history
  const updated = await prisma.department.update({
    where: { id },
    data: { managerId: managerId || null },
    include: {
      manager: { include: { user: { select: { name: true, email: true } } } },
    },
  })

  if (managerId) {
    await prisma.departmentManagerHistory.create({
      data: {
        departmentId: id,
        managerId,
        assignedById: session.userId,
        reason: reason || null,
      },
    })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CHANGE_MANAGER',
    entityType: 'Department',
    entityId: id,
    metadata: { oldManagerId, newManagerId: managerId, reason },
  })

  return successResponse(updated)
}
