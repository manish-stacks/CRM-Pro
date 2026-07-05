// src/app/api/tracking/visits/route.ts
// Admin/Manager: all client visits with filters (user, date range, status).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, getPaginationParams } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: any = {}
  if (userId) where.userId = userId
  if (status) where.status = status.toUpperCase()
  if (dateFrom || dateTo) {
    where.scheduledDate = {}
    if (dateFrom) where.scheduledDate.gte = new Date(dateFrom)
    if (dateTo) where.scheduledDate.lte = new Date(dateTo + 'T23:59:59')
  }

  const [visits, total] = await Promise.all([
    prisma.clientVisit.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        client: { select: { id: true, clientCode: true, clientName: true } },
      },
    }),
    prisma.clientVisit.count({ where }),
  ])

  return successResponse(visits, total)
}
