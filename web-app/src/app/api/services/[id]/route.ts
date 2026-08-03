// src/app/api/services/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

const UPDATABLE = new Set(['name', 'description', 'category', 'departmentId', 'basePrice', 'billingCycle', 'isActive'])

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
  if (data.basePrice !== undefined) data.basePrice = Number(data.basePrice) || 0

  try {
    const svc = await prisma.serviceCatalog.update({ where: { id }, data })
    await logFromRequest(req, {
      userId: session.userId, action: 'UPDATE', entityType: 'ServiceCatalog', entityId: id, changes: data,
    })
    return successResponse(svc)
  } catch (e: any) {
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    await prisma.serviceCatalog.delete({ where: { id } })
    await logFromRequest(req, {
      userId: session.userId, action: 'DELETE', entityType: 'ServiceCatalog', entityId: id,
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse(e.message || 'Delete failed')
  }
}
