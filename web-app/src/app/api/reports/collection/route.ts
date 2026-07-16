// src/app/api/reports/collection/route.ts
// Admin ka "shaam ka hisaab" — kis MARKETING_EXECUTIVE ne aaj kitna collect kiya,
// method-wise (CASH / UPI / BANK / CHEQUE / CARD / GATEWAY), + uske visits.
// Fraud check ke liye date-wise / exec-wise / method-wise filter.
//
//   GET ?range=today|yesterday|week|month   ya  ?dateFrom=&dateTo=
//       &userId=<exec>   &method=CASH   &view=summary|transactions
//
// summary      -> per-executive rollup + grand totals (default)
// transactions -> raw payment list (drill-down / audit)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, getPaginationParams } from '@/lib/api'

const METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

function resolveRange(searchParams: URLSearchParams) {
  const range = searchParams.get('range') || 'today'
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  if (dateFrom || dateTo) {
    const start = dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date('2000-01-01')
    const end = dateTo ? new Date(dateTo + 'T23:59:59.999') : new Date()
    return { start, end, label: 'custom' }
  }

  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setHours(23, 59, 59, 999)

  if (range === 'yesterday') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  } else if (range === 'week') {
    start.setDate(start.getDate() - start.getDay())
  } else if (range === 'month') {
    start.setDate(1)
  } else if (range === 'all') {
    start.setFullYear(2000, 0, 1)
  }
  return { start, end, label: range }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const { start, end, label } = resolveRange(searchParams)
  const userId = searchParams.get('userId')
  const method = searchParams.get('method')
  const view = searchParams.get('view') || 'summary'

  const payWhere: any = { paidAt: { gte: start, lte: end } }
  if (userId) payWhere.collectedById = userId
  if (method && METHODS.includes(method)) payWhere.method = method

  // ---------------- TRANSACTIONS (drill-down) ----------------
  if (view === 'transactions') {
    const { skip, limit } = getPaginationParams(searchParams)
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where: payWhere, skip, take: limit,
        orderBy: { paidAt: 'desc' },
        include: {
          collectedBy: { select: { id: true, name: true, avatar: true } },
          invoice: {
            select: {
              id: true, invoiceNumber: true,
              client: { select: { id: true, clientCode: true, clientName: true, companyName: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where: payWhere }),
    ])
    return successResponse(rows, total)
  }

  // ---------------- SUMMARY ----------------
  const execs = await prisma.user.findMany({
    where: {
      role: { in: ['MARKETING_EXECUTIVE', 'MANAGER'] },
      ...(userId ? { id: userId } : {}),
    },
    select: { id: true, name: true, avatar: true, role: true, isActive: true },
    orderBy: { name: 'asc' },
  })

  const [byExecMethod, visitGroups, payments] = await Promise.all([
    prisma.payment.groupBy({
      by: ['collectedById', 'method'],
      where: payWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.clientVisit.groupBy({
      by: ['userId', 'status'],
      where: {
        scheduledDate: { gte: start, lte: end },
        ...(userId ? { userId } : {}),
      },
      _count: { _all: true },
    }),
    // Unassigned (collectedById null) ko alag dikhane ke liye
    prisma.payment.aggregate({
      where: { ...payWhere, collectedById: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const blank = () => METHODS.reduce((a, m) => ({ ...a, [m]: 0 }), {} as Record<string, number>)

  const rows = execs.map(u => {
    const methods = blank()
    let total = 0
    let txns = 0
    byExecMethod
      .filter(g => g.collectedById === u.id)
      .forEach(g => {
        const amt = g._sum.amount || 0
        methods[g.method] = (methods[g.method] || 0) + amt
        total += amt
        txns += g._count._all
      })

    const v = visitGroups.filter(g => g.userId === u.id)
    const visitsTotal = v.reduce((a, g) => a + g._count._all, 0)
    const visitsCompleted = v.filter(g => g.status === 'COMPLETED').reduce((a, g) => a + g._count._all, 0)
    const visitsPending = v.filter(g => ['PENDING', 'IN_PROGRESS'].includes(g.status)).reduce((a, g) => a + g._count._all, 0)

    return {
      userId: u.id,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      isActive: u.isActive,
      methods,
      cash: methods.CASH,
      upi: methods.UPI,
      bank: methods.BANK_TRANSFER,
      cheque: methods.CHEQUE,
      card: methods.CARD,
      online: methods.ONLINE_GATEWAY,
      total,
      txns,
      visitsTotal,
      visitsCompleted,
      visitsPending,
    }
  })
  // Sirf woh log jinke total ya visits hain — clutter kam
  .filter(r => r.total > 0 || r.visitsTotal > 0 || userId)
  .sort((a, b) => b.total - a.total)

  const totals = rows.reduce(
    (acc, r) => {
      METHODS.forEach(m => { acc.methods[m] += r.methods[m] })
      acc.total += r.total
      acc.txns += r.txns
      acc.visitsTotal += r.visitsTotal
      acc.visitsCompleted += r.visitsCompleted
      acc.visitsPending += r.visitsPending
      return acc
    },
    { methods: blank(), total: 0, txns: 0, visitsTotal: 0, visitsCompleted: 0, visitsPending: 0 }
  )

  return successResponse({
    range: { from: start.toISOString(), to: end.toISOString(), label },
    rows,
    totals: {
      ...totals,
      cash: totals.methods.CASH,
      upi: totals.methods.UPI,
      bank: totals.methods.BANK_TRANSFER,
      cheque: totals.methods.CHEQUE,
      card: totals.methods.CARD,
      online: totals.methods.ONLINE_GATEWAY,
    },
    unassigned: {
      total: payments._sum.amount || 0,
      txns: payments._count._all,
    },
  })
}
