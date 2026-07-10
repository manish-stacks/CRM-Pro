import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'

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

      // Birthday detection
      const today = { month: now.getMonth() + 1, day: now.getDate() }
      const allUsers = await prisma.user.findMany({
        where: { isActive: true, dateOfBirth: { not: null } },
        select: { id: true, name: true, dateOfBirth: true, avatar: true },
      })
      const allEmployees = await prisma.employee.findMany({
        where: { dateOfBirth: { not: null }, user: { isActive: true } },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          department: { select: { name: true } },
        },
      })

      // Today's birthdays
      const birthdaysToday = allUsers.filter(u => {
        const dob = u.dateOfBirth!
        return dob.getMonth() + 1 === today.month && dob.getDate() === today.day
      }).map(u => ({ id: u.id, name: u.name, isSelf: u.id === session.userId }))

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
        prisma.employee.count({ where: { user: { isActive: true } } }),
        prisma.lead.count(),
        prisma.client.count(),
        prisma.proposal.count(),
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

      const revenueChart = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const res = await prisma.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: d, lte: end } } })
        revenueChart.push({ month: d.toLocaleString('default', { month: 'short' }), revenue: res._sum.amount || 0 })
      }

      const leadsByStatus = (await prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }))
        .map(l => ({ status: l.status, count: l._count._all }))

      return successResponse({
        stats: { totalEmployees, totalLeads, totalClients, totalProposals, pendingLeaves, monthRevenue: monthRevenue._sum.amount || 0 },
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