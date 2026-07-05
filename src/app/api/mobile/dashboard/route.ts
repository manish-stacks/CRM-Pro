// src/app/api/mobile/dashboard/route.ts
// Marketing person dashboard stats.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session, employee } = res as any
  if (!employee) return fail('Employee profile not found', 404)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const attToday = todayDateOnly() // UTC date-only to match how attendance is stored

  // Clients this marketing person onboarded / owns
  const clientWhere = {
    OR: [
      { marketingPersonId: session.userId },
      { reportingPersonId: session.userId },
      { telecallerId: session.userId },
    ],
  }

  const [totalClients, todayVisits, pendingVisits, completedVisits, attendance] = await Promise.all([
    prisma.client.count({ where: clientWhere }),
    prisma.clientVisit.count({
      where: { userId: session.userId, scheduledDate: { gte: today, lt: tomorrow } },
    }),
    prisma.clientVisit.count({
      where: { userId: session.userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    }),
    prisma.clientVisit.count({
      where: { userId: session.userId, status: 'COMPLETED' },
    }),
    prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: attToday } },
    }),
  ])

  // Recent activity (last 5 visits)
  const recentVisits = await prisma.clientVisit.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { id: true, clientName: true, status: true, updatedAt: true, purpose: true },
  })

  return ok({
    total_clients: totalClients,
    today_visits: todayVisits,
    pending_visits: pendingVisits,
    completed_visits: completedVisits,
    is_checked_in: !!(attendance?.punchIn && !attendance?.punchOut),
    recent_activity: recentVisits.map(v => ({
      title: `${v.clientName} — ${v.status.toLowerCase()}`,
      description: v.purpose || '',
      time: v.updatedAt,
    })),
  })
}
