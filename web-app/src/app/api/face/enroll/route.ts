// src/app/api/face/enroll/route.ts
// GET    ?employeeId=  -> is this employee enrolled? (no ?employeeId = list of enrolled ids)
// POST   {employeeId, descriptors} -> save/replace face samples (admin only)
// DELETE ?employeeId=  -> remove face data (admin only)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { validDescriptor } from '@/lib/faceMatch'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Admin only', 403)
  const rows = await prisma.faceProfile.findMany({ select: { employeeId: true, updatedAt: true } })
  return successResponse(rows)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Admin only', 403)

  const { employeeId, descriptors } = await req.json()
  if (!employeeId || !Array.isArray(descriptors) || descriptors.length < 3 || descriptors.length > 10 ||
      !descriptors.every(validDescriptor)) {
    return errorResponse('Send 3 to 10 valid face samples')
  }
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } })
  if (!emp) return errorResponse('Employee not found', 404)

  const row = await prisma.faceProfile.upsert({
    where: { employeeId },
    update: { descriptors: JSON.stringify(descriptors), enrolledById: session.userId },
    create: { employeeId, descriptors: JSON.stringify(descriptors), enrolledById: session.userId },
  })
  await logFromRequest(req, {
    userId: session.userId, action: 'FACE_ENROLL', entityType: 'Employee', entityId: employeeId,
  })
  return successResponse({ id: row.id })
}

export async function DELETE(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return errorResponse('Admin only', 403)
  const employeeId = new URL(req.url).searchParams.get('employeeId')
  if (!employeeId) return errorResponse('employeeId required')
  await prisma.faceProfile.deleteMany({ where: { employeeId } })
  await logFromRequest(req, {
    userId: session.userId, action: 'FACE_REMOVE', entityType: 'Employee', entityId: employeeId,
  })
  return successResponse({ removed: true })
}
