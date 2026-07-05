// src/app/api/employee-tickets/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const UPDATABLE = new Set(['subject', 'description', 'priority', 'category', 'departmentId', 'assignedToId', 'status', 'resolution'])

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const t = await prisma.employeeTicket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      department: { select: { id: true, name: true, color: true } },
      replies: {
        include: { user: { select: { name: true, avatar: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!t) return notFoundResponse('Ticket')
  return successResponse(t)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) data[k] = v === '' ? null : v
  }
  if (data.status === 'RESOLVED' || data.status === 'CLOSED') data.resolvedAt = new Date()

  const updated = await prisma.employeeTicket.update({ where: { id }, data })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'EmployeeTicket', entityId: id, changes: data,
  })
  return successResponse(updated)
}
