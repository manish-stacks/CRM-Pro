// src/app/api/tracking/visits/route.ts
// GET  — Admin/Manager: all client visits with filters (user, date range, status, quick range).
// POST — Admin/Manager: manually schedule a visit for a MARKETING_EXECUTIVE.
//        The visit instantly shows up in the exec's mobile app + web panel and
//        the exec gets an in-app + FCM/Expo push notification.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'
import { dateOnly } from '@/lib/attendanceDate'

// scheduledDate is a @db.Date column (stored as UTC-midnight of the IST
// calendar date) — bound the range using that same convention, resolved via
// IST, not the ambient server/process timezone.
function dayRange(d: Date) {
  const start = dateOnly(d)
  const end = new Date(start.getTime() + 86400000 - 1)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  const range = searchParams.get('range')      // today | upcoming | overdue | week | month
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const search = searchParams.get('search')

  const where: any = {}
  if (userId) where.userId = userId
  if (status) where.status = status.toUpperCase()
  if (search) {
    where.OR = [
      { clientName: { contains: search } },
      { purpose: { contains: search } },
    ]
  }

  const now = new Date()
  const today = dayRange(now)

  if (range === 'today') {
    where.scheduledDate = { gte: today.start, lte: today.end }
  } else if (range === 'upcoming') {
    where.scheduledDate = { gt: today.end }
    where.status = where.status || { in: ['PENDING', 'IN_PROGRESS'] }
  } else if (range === 'overdue') {
    where.scheduledDate = { lt: today.start }
    where.status = where.status || { in: ['PENDING', 'IN_PROGRESS'] }
  } else if (range === 'week') {
    const start = new Date(today.start); start.setUTCDate(start.getUTCDate() - start.getUTCDay())
    const end = new Date(start.getTime() + 7 * 86400000 - 1)
    where.scheduledDate = { gte: start, lte: end }
  } else if (range === 'month') {
    const start = new Date(today.start); start.setUTCDate(1)
    const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); end.setTime(end.getTime() - 1)
    where.scheduledDate = { gte: start, lte: end }
  } else if (dateFrom || dateTo) {
    where.scheduledDate = {}
    if (dateFrom) where.scheduledDate.gte = dateOnly(dateFrom)
    if (dateTo) where.scheduledDate.lte = dateOnly(dateTo)
  }

  const [visits, total, counts] = await Promise.all([
    prisma.clientVisit.findMany({
      where, skip, take: limit,
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, name: true, avatar: true, role: true } },
        createdBy: { select: { id: true, name: true } },
        client: { select: { id: true, clientCode: true, clientName: true } },
        lead: { select: { id: true, leadNumber: true, status: true } },
      },
    }),
    prisma.clientVisit.count({ where }),
    // Header stat chips (respect the userId filter only)
    (async () => {
      const base: any = userId ? { userId } : {}
      const [pending, todayCount, completed, overdue] = await Promise.all([
        prisma.clientVisit.count({ where: { ...base, status: 'PENDING' } }),
        prisma.clientVisit.count({ where: { ...base, scheduledDate: { gte: today.start, lte: today.end } } }),
        prisma.clientVisit.count({ where: { ...base, status: 'COMPLETED' } }),
        prisma.clientVisit.count({ where: { ...base, status: { in: ['PENDING', 'IN_PROGRESS'] }, scheduledDate: { lt: today.start } } }),
      ])
      return { pending, today: todayCount, completed, overdue }
    })(),
  ])

  return successResponse({ visits, counts }, total)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json().catch(() => ({}))
  const { userId, clientId, clientName, purpose, notes, scheduledDate, scheduledTime, location } = body

  if (!userId) return errorResponse('Marketing executive (userId) is required')
  if (!scheduledDate) return errorResponse('Visit date is required')

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isActive: true },
  })
  if (!target) return errorResponse('User not found', 404)
  if (!target.isActive) return errorResponse('Cannot assign a visit to a disabled user')
  if (!['MARKETING_EXECUTIVE', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(target.role)) {
    return errorResponse('Visits can only be assigned to a MARKETING_EXECUTIVE (or higher)')
  }

  let name = clientName?.trim()
  if (!name && clientId) {
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { companyName: true, clientName: true } })
    name = c?.companyName || c?.clientName
  }
  if (!name) return errorResponse('Client name is required')

  const sd = new Date(scheduledDate)
  if (isNaN(sd.getTime())) return errorResponse('Invalid visit date')

  const visit = await prisma.clientVisit.create({
    data: {
      userId,
      clientId: clientId || null,
      createdById: session.userId,
      clientName: name,
      purpose: purpose?.trim() || null,
      notes: notes?.trim() || null,
      scheduledDate: sd,
      scheduledTime: scheduledTime?.trim() || null,
      checkInAddress: location?.trim() || null,
      status: 'PENDING',
      source: 'MANUAL',
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  })

  // Notify the exec (in-app + push). Awaited on purpose.
  try {
    await Notifications.visitAssigned(userId, name, sd.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }), visit.id)
  } catch (e) {
    console.error('Visit assign notify failed:', e)
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'ClientVisit',
    entityId: visit.id,
    metadata: { assignedTo: target.name, clientName: name, scheduledDate: sd },
  })

  return successResponse(visit)
}
