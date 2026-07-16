// src/app/api/mobile/meetings/route.ts
// Meetings assigned to the logged-in marketing executive.
// A "meeting" is a Lead with status MEETING_SCHEDULED whose meetingAssignedToId
// is this user.
//
// Filters (app ki tabs isi pe chalti hain):
//   ?range=today | tomorrow | upcoming | week | past | all
//   ?date=YYYY-MM-DD        (exact date)
//   ?dateFrom=&dateTo=      (custom range)
//   ?status=meeting_scheduled|converted|closed|not_interested
//   ?search=
// ETA (Zomato style):
//   ?lat=&lng=  bhejo to har meeting pe distance + traffic-aware ETA aayega.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok } from '@/lib/mobileAuth'
import { getEtas, geocodeAddress } from '@/lib/distance'

function dayRange(d: Date) {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(d); end.setHours(23, 59, 59, 999)
  return { start, end }
}

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') || 'upcoming'
  const range = searchParams.get('range')
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')

  const where: any = { meetingAssignedToId: session.userId }

  if (status && status !== 'all') where.status = status.toUpperCase()
  else if (range === 'past') where.status = { in: ['CONVERTED', 'CLOSED', 'NOT_INTERESTED', 'MEETING_SCHEDULED'] }
  else if (!range && scope !== 'all') where.status = 'MEETING_SCHEDULED'
  else if (range && range !== 'all') where.status = 'MEETING_SCHEDULED'

  if (search) {
    where.OR = [
      { clientName: { contains: search } },
      { companyName: { contains: search } },
      { leadNumber: { contains: search } },
      { clientPhone: { contains: search } },
    ]
  }

  const now = new Date()
  const today = dayRange(now)
  const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1)
  const tomorrow = dayRange(tomorrowDate)

  if (date) {
    const d = dayRange(new Date(date))
    where.meetingDate = { gte: d.start, lte: d.end }
  } else if (range === 'today') {
    where.meetingDate = { gte: today.start, lte: today.end }
  } else if (range === 'tomorrow') {
    where.meetingDate = { gte: tomorrow.start, lte: tomorrow.end }
  } else if (range === 'upcoming') {
    where.meetingDate = { gt: today.end }
  } else if (range === 'week') {
    const end = new Date(today.start); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999)
    where.meetingDate = { gte: today.start, lte: end }
  } else if (range === 'past') {
    where.meetingDate = { lt: today.start }
  } else if (dateFrom || dateTo) {
    where.meetingDate = {}
    if (dateFrom) where.meetingDate.gte = new Date(dateFrom)
    if (dateTo) where.meetingDate.lte = new Date(dateTo + 'T23:59:59')
  }

  const select = {
    id: true, leadNumber: true, companyName: true, clientName: true,
    clientPhone: true, clientEmail: true, address: true, city: true, state: true,
    status: true, meetingDate: true, meetingTime: true, meetingSlot: true,
    meetingLocation: true, meetingLat: true, meetingLng: true, meetingNotes: true,
  }

  const base = { meetingAssignedToId: session.userId, status: 'MEETING_SCHEDULED' }
  const [leads, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ meetingDate: 'asc' }, { meetingTime: 'asc' }, { createdAt: 'desc' }],
      take: 150,
      select,
    }),
    (async () => {
      const [all, todayC, tomorrowC, upcoming, past] = await Promise.all([
        prisma.lead.count({ where: base }),
        prisma.lead.count({ where: { ...base, meetingDate: { gte: today.start, lte: today.end } } }),
        prisma.lead.count({ where: { ...base, meetingDate: { gte: tomorrow.start, lte: tomorrow.end } } }),
        prisma.lead.count({ where: { ...base, meetingDate: { gt: today.end } } }),
        prisma.lead.count({ where: { meetingAssignedToId: session.userId, meetingDate: { lt: today.start } } }),
      ])
      return { all, today: todayC, tomorrow: tomorrowC, upcoming, past }
    })(),
  ])

  const addrOf = (l: any) =>
    l.meetingLocation || [l.address, l.city, l.state].filter(Boolean).join(', ') || null

  // ---- Lazy geocode: pehli baar address ko lat/lng me convert kar ke save kar do ----
  const needGeo = leads.filter(l => (l.meetingLat == null || l.meetingLng == null) && addrOf(l))
  if (needGeo.length && !isNaN(lat) && !isNaN(lng)) {
    await Promise.all(
      needGeo.slice(0, 10).map(async l => {
        const pt = await geocodeAddress(addrOf(l) as string)
        if (!pt) return
        ;(l as any).meetingLat = pt.lat
        ;(l as any).meetingLng = pt.lng
        prisma.lead.update({ where: { id: l.id }, data: { meetingLat: pt.lat, meetingLng: pt.lng } }).catch(() => {})
      })
    )
  }

  // ---- ETA ----
  let etaMap: Record<string, any> = {}
  if (!isNaN(lat) && !isNaN(lng) && leads.length) {
    const etas = await getEtas(
      { lat, lng },
      leads.map(l => ({
        key: l.id,
        point: l.meetingLat != null && l.meetingLng != null ? { lat: l.meetingLat, lng: l.meetingLng } : null,
        address: addrOf(l),
      }))
    )
    etas.forEach(e => { etaMap[e.key] = e })
  }

  return ok(
    leads.map(l => {
      const e = etaMap[l.id]
      return {
        id: l.id,
        lead_number: l.leadNumber,
        client_name: l.clientName,
        company: l.companyName,
        client_phone: l.clientPhone,
        client_email: l.clientEmail,
        status: l.status.toLowerCase(),
        meeting_date: l.meetingDate ? l.meetingDate.toISOString().slice(0, 10) : null,
        meeting_time: l.meetingTime || l.meetingSlot || null,
        address: addrOf(l),
        lat: l.meetingLat,
        lng: l.meetingLng,
        notes: l.meetingNotes || null,
        // Zomato-style: "8.2 km · 24 min away"
        distance_text: e?.distanceText || null,
        eta_text: e?.durationText || null,
        eta_secs: e?.durationSecs ?? null,
        distance_meters: e?.distanceMeters ?? null,
        eta_approx: e?.approx ?? null,
      }
    }),
    { counts }
  )
}
