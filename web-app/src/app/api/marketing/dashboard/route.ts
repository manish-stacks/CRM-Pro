// src/app/api/marketing/dashboard/route.ts
// Marketing executive's dashboard: today's meetings, past, upcoming, stats
// Admin can see any exec's dashboard by passing ?userId=X
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, hasMinRole } from '@/lib/auth'
import { successResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('userId')
  const canSeeOthers = hasMinRole(session.role, 'ADMIN')
  const userId = canSeeOthers && targetUserId ? targetUserId : session.userId

  // ---- Date filters (My Meetings page ki filter bar) ----
  //   ?range=today|tomorrow|upcoming|week|past|all   ?date=YYYY-MM-DD   ?dateFrom=&dateTo=
  //   ?status=MEETING_SCHEDULED|CONVERTED|CLOSED|NOT_INTERESTED   ?search=
  const range = searchParams.get('range') || ''
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const statusFilter = searchParams.get('status')
  const search = searchParams.get('search')

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const weekEnd    = new Date(now); weekEnd.setDate(now.getDate() + 7)
  const tmrStart   = new Date(todayStart); tmrStart.setDate(tmrStart.getDate() + 1)
  const tmrEnd     = new Date(todayEnd); tmrEnd.setDate(tmrEnd.getDate() + 1)

  const filterActive = !!(range || date || dateFrom || dateTo || statusFilter || search)

  const buildWhere = () => {
    const w: any = { meetingAssignedToId: userId }
    if (statusFilter) w.status = statusFilter
    if (search) {
      w.OR = [
        { clientName: { contains: search } },
        { companyName: { contains: search } },
        { leadNumber: { contains: search } },
        { clientPhone: { contains: search } },
      ]
    }
    if (date) {
      const d0 = new Date(date + 'T00:00:00'); const d1 = new Date(date + 'T23:59:59.999')
      w.meetingDate = { gte: d0, lte: d1 }
    } else if (range === 'today') {
      w.meetingDate = { gte: todayStart, lte: todayEnd }
    } else if (range === 'tomorrow') {
      w.meetingDate = { gte: tmrStart, lte: tmrEnd }
    } else if (range === 'upcoming') {
      w.meetingDate = { gt: todayEnd }
    } else if (range === 'week') {
      w.meetingDate = { gte: todayStart, lte: weekEnd }
    } else if (range === 'past') {
      w.meetingDate = { lt: todayStart }
    } else if (dateFrom || dateTo) {
      w.meetingDate = {}
      if (dateFrom) w.meetingDate.gte = new Date(dateFrom)
      if (dateTo) w.meetingDate.lte = new Date(dateTo + 'T23:59:59')
    }
    return w
  }

  // Filter laga ho to ek hi filtered list bhejo; warna purana today/upcoming/past layout
  const filteredMeetings = filterActive
    ? await prisma.lead.findMany({
        where: buildWhere(),
        include: {
          assignedTo: { select: { name: true, phone: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ meetingDate: 'asc' }, { meetingTime: 'asc' }],
        take: 200,
      })
    : null

  const todayMeetings = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: userId,
      meetingDate: { gte: todayStart, lte: todayEnd },
    },
    include: {
      assignedTo: { select: { name: true, phone: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { meetingTime: 'asc' },
  })

  const upcomingMeetings = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: userId,
      meetingDate: { gt: todayEnd, lte: weekEnd },
      status: { in: ['MEETING_SCHEDULED', 'FOLLOW_UP'] },
    },
    include: { assignedTo: { select: { name: true } } },
    orderBy: { meetingDate: 'asc' },
    take: 20,
  })

  const past30Days = new Date(now); past30Days.setDate(now.getDate() - 30)
  const pastMeetings = await prisma.lead.findMany({
    where: {
      meetingAssignedToId: userId,
      meetingDate: { gte: past30Days, lt: todayStart },
    },
    include: { assignedTo: { select: { name: true } } },
    orderBy: { meetingDate: 'desc' },
    take: 30,
  })

  const tomorrowCount = await prisma.lead.count({
    where: { meetingAssignedToId: userId, meetingDate: { gte: tmrStart, lte: tmrEnd }, status: 'MEETING_SCHEDULED' },
  })

  const [totalAssigned, converted, closed, notInterested, meetingScheduled] = await Promise.all([
    prisma.lead.count({ where: { meetingAssignedToId: userId } }),
    prisma.lead.count({ where: { meetingAssignedToId: userId, status: 'CONVERTED' } }),
    prisma.lead.count({ where: { meetingAssignedToId: userId, status: 'CLOSED' } }),
    prisma.lead.count({ where: { meetingAssignedToId: userId, status: 'NOT_INTERESTED' } }),
    prisma.lead.count({ where: { meetingAssignedToId: userId, status: 'MEETING_SCHEDULED' } }),
  ])

  const conversionRate = totalAssigned > 0 ? Math.round((converted / totalAssigned) * 100) : 0

  return successResponse({
    todayMeetings,
    upcomingMeetings,
    pastMeetings,
    filteredMeetings,          // null = no filter applied
    filterActive,
    stats: {
      totalAssigned, converted, closed, notInterested, meetingScheduled,
      conversionRate,
      openCount: meetingScheduled,
      todayCount: todayMeetings.length,
      tomorrowCount,
    },
  })
}
