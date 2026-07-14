// src/app/api/audit-logs/route.ts
// Admin-only audit log viewer with filters
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, getPaginationParams } from '@/lib/api'

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
