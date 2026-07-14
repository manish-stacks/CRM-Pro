// src/app/api/departments/[id]/route.ts
// Update or delete department; manager change is a separate endpoint to record history.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const UPDATABLE = new Set(['name', 'description', 'color', 'icon', 'isActive'])

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      manager: { include: { user: { select: { name: true, email: true, phone: true } } } },
      employees: {
        include: { user: { select: { name: true, email: true, avatar: true, isActive: true } } },
      },
      managerHistory: {
        orderBy: { assignedAt: 'desc' },
        take: 10,
      },
      _count: { select: { employees: true } },
    },
  })
  if (!dept) return notFoundResponse('Department')
  return successResponse(dept)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()
  const data: Record<string, any> = {}
  for (const [k, v] of Object.entries(body)) {
    if (UPDATABLE.has(k)) data[k] = v === '' ? null : v
  }
  if (data.name) data.slug = slugify(data.name)

  try {
    const dept = await prisma.department.update({ where: { id }, data })
    await logFromRequest(req, {
      userId: session.userId,
      action: 'UPDATE',
      entityType: 'Department',
      entityId: id,
      changes: data,
    })
    return successResponse(dept)
  } catch (e: any) {
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  // Guard: can't delete if there are employees
  const empCount = await prisma.employee.count({ where: { departmentId: id } })
  if (empCount > 0) {
    return errorResponse(`Cannot delete: ${empCount} employee(s) are still in this department. Reassign them first.`)
  }

  try {
    await prisma.department.delete({ where: { id } })
    await logFromRequest(req, {
      userId: session.userId,
      action: 'DELETE',
      entityType: 'Department',
      entityId: id,
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse(e.message || 'Delete failed')
  }
}
