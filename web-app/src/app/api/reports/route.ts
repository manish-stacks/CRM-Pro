import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { isCompanyWideRole } from '@/lib/permissions'
import { cached } from '@/lib/memoCache'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const period = parseInt(searchParams.get('period') || '12')

  try {
    if (type === 'dashboard') {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      // Birthday detection - query employees with user info once
      const today = { month: now.getMonth() + 1, day: now.getDate() }
      const allEmployees = await prisma.employee.findMany({
        where: { dateOfBirth: { not: null }, user: { isActive: true } },
        select: {
          id: true,
          userId: true,
          dateOfBirth: true,
          department: { select: { name: true } },
          user: { select: { id: true, name: true, avatar: true } },
        },
      })

      // Today's birthdays
      const birthdaysToday = allEmployees
        .filter(emp => {
          const dob = emp.dateOfBirth!
          return dob.getMonth() + 1 === today.month && dob.getDate() === today.day
        })
        .map(emp => ({ id: emp.user.id, name: emp.user.name, isSelf: emp.user.id === session.userId }))

      // Upcoming 30 days
      const upcomingBirthdays = allEmployees
        .map(emp => {
          const dob = emp.dateOfBirth!
          const thisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
          if (thisYear < now) thisYear.setFullYear(now.getFullYear() + 1)
          const daysUntil = Math.ceil((thisYear.getTime() - now.getTime()) / 86400000)
          const isToday = dob.getMonth() + 1 === today.month && dob.getDate() === today.day
          return {
            id: emp.id, name: emp.user.name, dateOfBirth: emp.dateOfBirth!.toISOString(),
            department: emp.department?.name, daysUntil: isToday ? 0 : daysUntil, isToday,
          }
        })
        .filter(e => e.daysUntil <= 30)
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 10)

      let pendingLeavesWhere: any = { status: 'PENDING' }
      if (session.role === 'MANAGER') {
        const { getTeamScope } = await import('@/lib/teamScope')
        const scope = await getTeamScope(session.userId)
        pendingLeavesWhere.employeeId = { in: scope.visibleIds.length ? scope.visibleIds : ['__none__'] }
      }

      const [totalEmployees, totalLeads, totalClients, totalProposals, pendingLeaves, monthRevenue] = await Promise.all([
        cached('employees:total', 30_000, () => prisma.employee.count({ where: { user: { isActive: true } } })),
        cached('leads:total', 30_000, () => prisma.lead.count()),
        cached('clients:total', 30_000, () => prisma.client.count()),
        cached('proposals:total', 30_000, () => prisma.proposal.count()),
        prisma.leave.count({ where: pendingLeavesWhere }),
        prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: monthStart } } }),
      ])

      const recentLeads = await prisma.lead.findMany({
        take: 5, orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { name: true } } },
      })

      const expiringServices = await prisma.clientService.findMany({
        where: { expiryDate: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() }, status: 'ACTIVE' },
        include: { client: { select: { companyName: true } } },
        take: 6, orderBy: { expiryDate: 'asc' },
      })

      // Revenue is admin-only — everyone else gets an empty series / zero.
      // Optimized: 1 query for all 6 months instead of 6 separate sequential queries!
      const canSeeRevenue = isCompanyWideRole(session.role)
      const revenueChart: { month: string; revenue: number }[] = []
      if (canSeeRevenue) {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
        const pastPayments = await prisma.payment.findMany({
          where: { paidAt: { gte: sixMonthsAgo } },
          select: { amount: true, paidAt: true },
        })
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const targetMonth = d.getMonth()
          const targetYear = d.getFullYear()
          const sum = pastPayments
            .filter(p => {
              const dt = new Date(p.paidAt)
              return dt.getMonth() === targetMonth && dt.getFullYear() === targetYear
            })
            .reduce((acc, p) => acc + (p.amount || 0), 0)
          revenueChart.push({ month: d.toLocaleString('default', { month: 'short' }), revenue: sum })
        }
      }

      const leadsByStatus = (await cached('leads:byStatus', 60_000, () => prisma.lead.groupBy({ by: ['status'], _count: { _all: true } })))
        .map(l => ({ status: l.status, count: l._count._all }))

      return successResponse({
        stats: { totalEmployees, totalLeads, totalClients, totalProposals, pendingLeaves, monthRevenue: canSeeRevenue ? (monthRevenue._sum.amount || 0) : 0 },
        birthdays: birthdaysToday,
        upcomingBirthdays,
        revenueChart,
        leadsByStatus,
        recentLeads,
        expiringServices,
      })
    }

    // Analytics
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - period + 1, 1)
    const revenue = []
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const r = await prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { paidAt: { gte: d, lte: end } } })
      revenue.push({ month: d.toLocaleString('default', { month: 'short', year: '2-digit' }), revenue: r._sum.amount || 0, count: r._count })
    }

    const [attRaw, leadStatusRaw, leadSourceRaw, totalLeads, converted] = await Promise.all([
      prisma.attendance.groupBy({ by: ['status'], _count: { _all: true }, where: { date: { gte: startDate } } }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true }, where: { createdAt: { gte: startDate } } }),
      prisma.lead.groupBy({ by: ['source'], _count: { _all: true }, where: { createdAt: { gte: startDate } } }),
      prisma.lead.count({ where: { createdAt: { gte: startDate } } }),
      prisma.lead.count({ where: { status: 'CONVERTED', createdAt: { gte: startDate } } }),
    ])

    const [totalEmp, totalClients, revSum, totalProp, acceptedProp] = await Promise.all([
      prisma.employee.count({ where: { user: { isActive: true } } }),
      prisma.client.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.proposal.count(),
      prisma.proposal.count({ where: { status: 'ACCEPTED' } }),
    ])

    return successResponse({
      revenue,
      attendance: attRaw.map(a => ({ status: a.status, count: a._count._all })),
      leads: {
        byStatus: leadStatusRaw.map(l => ({ status: l.status, count: l._count._all })),
        bySource: leadSourceRaw.map(l => ({ source: l.source, count: l._count._all })),
        conversionRate: totalLeads > 0 ? (converted / totalLeads) * 100 : 0,
      },
      totals: {
        totalRevenue: revSum._sum.amount || 0,
        totalEmployees: totalEmp,
        totalLeads,
        totalClients,
        proposalSuccessRate: totalProp > 0 ? (acceptedProp / totalProp) * 100 : 0,
      },
    })
  } catch (e) {
    console.error(e)
    return errorResponse('Failed')
  }
}