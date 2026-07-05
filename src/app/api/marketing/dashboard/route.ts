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

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const weekEnd    = new Date(now); weekEnd.setDate(now.getDate() + 7)

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
    stats: {
      totalAssigned, converted, closed, notInterested, meetingScheduled,
      conversionRate,
      openCount: meetingScheduled,
    },
  })
}
