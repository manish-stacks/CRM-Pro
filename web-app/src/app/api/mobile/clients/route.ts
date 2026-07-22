// src/app/api/mobile/clients/route.ts
// List clients owned by this marketing person + create new client.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { generateClientCode } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { istDayRange, todayDateOnly, getISTDateParts } from '@/lib/attendanceDate'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  // Filters: ?range=today|week|month  ?date=YYYY-MM-DD  ?dateFrom=&dateTo=
  //          ?status=ACTIVE  ?expiry=expired|7|30  ?search=
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const status = searchParams.get('status')
  const expiry = searchParams.get('expiry')
  const search = searchParams.get('search')

  const { start: todayStart, end: todayEnd } = istDayRange() // for createdAt (real timestamp)
  const expiryToday = todayDateOnly() // for expiryDate (@db.Date column)

  const where: any = {
    OR: [
      { marketingPersonId: session.userId },
      { reportingPersonId: session.userId },
      { telecallerId: session.userId },
    ],
  }
  if (status && status !== 'all') where.status = status.toUpperCase()
  if (search) {
    where.AND = [{
      OR: [
        { clientCode: { contains: search } },
        { clientName: { contains: search } },
        { companyName: { contains: search } },
        { phone: { contains: search } },
      ],
    }]
  }

  if (date) {
    const { start, end } = istDayRange(date)
    where.createdAt = { gte: start, lte: end }
  } else if (range === 'today') {
    where.createdAt = { gte: todayStart, lte: todayEnd }
  } else if (range === 'week') {
    const { year, month, day } = getISTDateParts(new Date())
    const dow = new Date(Date.UTC(year, month, day)).getUTCDay()
    const s0 = new Date(todayStart.getTime() - dow * 86400000)
    where.createdAt = { gte: s0, lte: todayEnd }
  } else if (range === 'month') {
    const { year, month } = getISTDateParts(new Date())
    const s0 = new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS)
    where.createdAt = { gte: s0, lte: todayEnd }
  } else if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = istDayRange(dateFrom).start
    if (dateTo) where.createdAt.lte = istDayRange(dateTo).end
  }

  if (expiry) {
    const svc: any = {}
    if (expiry === 'expired') svc.expiryDate = { lt: expiryToday }
    else {
      const days = parseInt(expiry)
      if (!isNaN(days)) {
        const until = new Date(expiryToday); until.setUTCDate(until.getUTCDate() + days); until.setUTCHours(23, 59, 59, 999)
        svc.expiryDate = { gte: expiryToday, lte: until }
      }
    }
    if (Object.keys(svc).length) where.services = { some: svc }
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true, clientCode: true, clientName: true, companyName: true,
      phone: true, email: true, city: true, status: true, createdAt: true,
      services: { select: { serviceName: true, expiryDate: true, status: true }, orderBy: { expiryDate: 'asc' }, take: 3 },
      _count: { select: { services: true } },
    },
  })

  const counts = {
    all: clients.length,
    today: clients.filter(c => c.createdAt >= todayStart && c.createdAt <= todayEnd).length,
  }

  return ok(
    clients.map(c => {
      const next = c.services.find(x => x.expiryDate)
      return {
        id: c.id,
        client_code: c.clientCode,
        name: c.clientName,
        company: c.companyName,
        phone: c.phone,
        email: c.email,
        city: c.city,
        status: c.status,
        services_count: c._count.services,
        service_names: c.services.map(x => x.serviceName),
        next_expiry: next?.expiryDate ? next.expiryDate.toISOString().slice(0, 10) : null,
        created_at: c.createdAt,
      }
    }),
    { counts }
  )
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { name, phone, email, company, address } = body

  if (!name?.trim()) return fail('Name is required')
  if (!phone?.trim()) return fail('Phone is required')

  const client = await prisma.client.create({
    data: {
      clientCode: await generateClientCode(),
      clientName: name.trim(),
      companyName: (company || name).trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      address: address?.trim() || null,
      status: 'ACTIVE',
      marketingPersonId: session.userId,
      reportingPersonId: session.userId,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'Client', entityId: client.id,
    metadata: { via: 'mobile', clientName: client.clientName },
  })

  return ok({
    id: client.id,
    name: client.clientName,
    company: client.companyName,
    phone: client.phone,
    client_code: client.clientCode,
  })
}
