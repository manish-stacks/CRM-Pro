import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok } from '@/lib/mobileAuth'
import { getEtas, geocodeAddress } from '@/lib/distance'
import { istDayRange, getISTDateParts } from '@/lib/attendanceDate'

function dayRange(dateStr?: string | null) {
  return istDayRange(dateStr)
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

  // A meeting stays in this list until it is either finished (marked done /
  // deal decided) or CANCELLED — and cancelling is the ONLY thing that clears
  // meetingAssignedToId, so cancelled ones drop out on their own.
  //
  // CALLBACK is included on purpose: "client didn't pick up" moves the lead to
  // CALLBACK and frees the slot, but the marketing person still owns it and
  // has to rebook it. Excluding CALLBACK is what made those meetings disappear
  // the moment they were marked no-answer.
  const ACTIVE = ['MEETING_SCHEDULED', 'CALLBACK', 'FOLLOW_UP']
  const HISTORY = ['CONVERTED', 'CLOSED', 'NOT_INTERESTED', 'MEETING_SCHEDULED', 'MEETING_DONE', 'CALLBACK', 'FOLLOW_UP']

  if (status && status !== 'all') where.status = status.toUpperCase()
  else if (range === 'past') where.status = { in: HISTORY }
  else if (range === 'rebook') where.status = { in: ['CALLBACK', 'FOLLOW_UP'] }
  else where.status = { in: ACTIVE }

  if (search) {
    where.OR = [
      { clientName: { contains: search } },
      { companyName: { contains: search } },
      { leadNumber: { contains: search } },
      { clientPhone: { contains: search } },
    ]
  }

  const today = dayRange()
  const { year: ty, month: tm, day: td } = getISTDateParts(new Date())
  const tmrDate = new Date(Date.UTC(ty, tm, td + 1))
  const tomorrowStr = tmrDate.toISOString().slice(0, 10)
  const tomorrow = dayRange(tomorrowStr)

  if (date) {
    const d = dayRange(date)
    where.meetingDate = { gte: d.start, lte: d.end }
  } else if (range === 'today') {
    where.meetingDate = { gte: today.start, lte: today.end }
  } else if (range === 'tomorrow') {
    where.meetingDate = { gte: tomorrow.start, lte: tomorrow.end }
  } else if (range === 'upcoming') {
    where.meetingDate = { gt: today.end }
  } else if (range === 'week') {
    const end = new Date(today.start.getTime() + 7 * 86400000 - 1)
    where.meetingDate = { gte: today.start, lte: end }
  } else if (range === 'past') {
    where.meetingDate = { lt: today.start }
    // Past + an explicit range = "show me my history between these dates".
    if (dateFrom) where.meetingDate.gte = dayRange(dateFrom).start
    if (dateTo) where.meetingDate.lte = dayRange(dateTo).end
  } else if (range === 'rebook') {
    // Slot was freed (no-answer) — no date on it yet, needs rebooking.
    where.meetingDate = null
  } else if (dateFrom || dateTo) {
    where.meetingDate = {}
    if (dateFrom) where.meetingDate.gte = dayRange(dateFrom).start
    if (dateTo) where.meetingDate.lte = dayRange(dateTo).end
  }

  const select = {
    id: true, leadNumber: true, companyName: true, clientName: true,
    clientPhone: true, clientEmail: true, address: true, city: true, state: true,
    status: true, meetingDate: true, meetingTime: true, meetingSlot: true,
    meetingLocation: true, meetingLat: true, meetingLng: true, meetingNotes: true,
  }

  const base = { meetingAssignedToId: session.userId, status: { in: ACTIVE } }
  const [leads, counts] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ meetingDate: 'asc' }, { meetingTime: 'asc' }, { createdAt: 'desc' }],
      take: 150,
      select,
    }),
    (async () => {
      const weekEnd = new Date(today.start.getTime() + 7 * 86400000 - 1)
      const [all, todayC, tomorrowC, upcoming, week, done, past] = await Promise.all([
        prisma.lead.count({ where: base }),
        prisma.lead.count({ where: { ...base, meetingDate: { gte: today.start, lte: today.end } } }),
        prisma.lead.count({ where: { ...base, meetingDate: { gte: tomorrow.start, lte: tomorrow.end } } }),
        prisma.lead.count({ where: { ...base, meetingDate: { gt: today.end } } }),
        prisma.lead.count({ where: { ...base, meetingDate: { gte: today.start, lte: weekEnd } } }),
        // "Meeting Done" tab badge — these no longer appear in the active tabs.
        prisma.lead.count({ where: { meetingAssignedToId: session.userId, status: 'MEETING_DONE' } }),
        prisma.lead.count({ where: { meetingAssignedToId: session.userId, meetingDate: { lt: today.start } } }),
      ])
      // Freed slots still sitting with this person, waiting to be rebooked.
      const rebook = await prisma.lead.count({
        where: {
          meetingAssignedToId: session.userId,
          status: { in: ['CALLBACK', 'FOLLOW_UP'] },
          meetingDate: null,
        },
      })
      return { all, today: todayC, tomorrow: tomorrowC, upcoming, week, done, past, rebook }
    })(),
  ])

  const addrOf = (l: any) =>
    l.meetingLocation || [l.address, l.city, l.state].filter(Boolean).join(', ') || null

  // ---- Lazy geocode: on first run, convert the address to lat/lng and save it ----
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
