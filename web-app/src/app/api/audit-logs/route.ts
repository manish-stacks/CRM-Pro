// src/app/api/audit-logs/route.ts
// Admin-only audit log viewer with filters
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: any = {}
  if (userId) where.userId = userId
  if (action) where.action = action
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59')
  }

  const [logs, total, distinctActions, distinctTypes] = await Promise.all([
    prisma.activityLog.findMany({
      where, skip, take: limit,
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' }, take: 50,
    }),
    prisma.activityLog.findMany({
      distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' }, take: 50,
    }),
  ])
  return successResponse({
    logs, total,
    actions: distinctActions.map(a => a.action).filter(Boolean),
    entityTypes: distinctTypes.map(t => t.entityType).filter(Boolean),
  })
}

// Admin-only: delete audit log entries — either a specific set of ids
// (checkbox selection) or everything matching the current filters (e.g.
// "clear all LOGIN_FAILED events before <date>"). At least one of the two
// must be provided so an empty body can't wipe the whole table by accident.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  const filters = body.filters || {}

  let where: any = {}
  if (ids.length > 0) {
    where = { id: { in: ids } }
  } else if (filters.userId || filters.action || filters.entityType || filters.dateFrom || filters.dateTo) {
    if (filters.userId) where.userId = filters.userId
    if (filters.action) where.action = filters.action
    if (filters.entityType) where.entityType = filters.entityType
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59')
    }
  } else {
    return NextResponse.json({ error: 'Provide ids or at least one filter — refusing to delete the entire log' }, { status: 400 })
  }

  const { count } = await prisma.activityLog.deleteMany({ where })

  // Deleting audit history is itself worth auditing.
  // await logFromRequest(req, {
  //   userId: auth.session.userId,
  //   action: 'DELETE',
  //   entityType: 'ActivityLog',
  //   metadata: ids.length > 0 ? { mode: 'selected', count } : { mode: 'filtered', filters, count },
  // })

  return successResponse({ deleted: count })
}
