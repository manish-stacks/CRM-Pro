// src/app/api/leads/route.ts
// Phase 3 rewrite: all new lead fields + role-based visibility + rich filters
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, getPaginationParams } from '@/lib/api'
import { generateLeadNumber } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { Notifications } from '@/lib/notify'
import { dateOnly } from '@/lib/attendanceDate'
import { getTeamUserIds } from '@/lib/teamScope'

const VALID_STATUSES = ['NEW', 'NOT_INTERESTED', 'FOLLOW_UP', 'RINGING', 'MEETING_SCHEDULED', 'CALLBACK', 'CONVERTED', 'CLOSED']

// DELETE /api/leads  { ids: string[] }  — admin-only bulk delete (also handles a single id).
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  let ids: string[] = []
  try {
    const body = await req.json()
    ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === 'string' && x) : []
  } catch {
    return errorResponse('Invalid request body')
  }
  if (ids.length === 0) return errorResponse('No lead ids provided')

  const leads = await prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, leadNumber: true } })
  if (leads.length === 0) return errorResponse('No matching leads found')

  const { count } = await prisma.lead.deleteMany({ where: { id: { in: leads.map(l => l.id) } } })

  await Promise.all(leads.map(l => logFromRequest(req, {
    userId: session.userId,
    action: 'DELETE',
    entityType: 'Lead',
    entityId: l.id,
    metadata: { leadNumber: l.leadNumber },
  })))

  return successResponse({ deleted: count })
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const g = (k: string) => searchParams.get(k)?.trim() || ''

  const status = g('status')                       // single, or comma list
  const source = g('source')
  const assignedToId = g('assignedToId')
  const meetingAssignedToId = g('meetingAssignedToId')
  const createdById = g('createdById')
  const search = g('search')
  const dateFrom = g('dateFrom')                   // created between
  const dateTo = g('dateTo')
  const followUpDate = g('followUpDate')           // exact day
  const followUpFrom = g('followUpFrom')
  const followUpTo = g('followUpTo')
  const callbackDate = g('callbackDate')
  const callbackFrom = g('callbackFrom')
  const callbackTo = g('callbackTo')
  const meetingDate = g('meetingDate')
  const meetingFrom = g('meetingFrom')
  const meetingTo = g('meetingTo')
  const city = g('city')
  const state = g('state')
  const service = g('service')
  const minPrice = g('minPrice')
  const maxPrice = g('maxPrice')
  const hasMeeting = g('hasMeeting')               // 'yes' | 'no'
  const hasEmail = g('hasEmail')                   // 'yes' | 'no'
  const due = g('due')                             // today | tomorrow | overdue | week | none
  const sortBy = g('sortBy')                       // nextaction | followup | created | oldest | updated | name

  const where: any = {}
  if (status) {
    const list = status.split(',').map(x => x.trim()).filter(Boolean)
    where.status = list.length > 1 ? { in: list } : list[0]
  }
  if (source) {
    const list = source.split(',').map(x => x.trim()).filter(Boolean)
    where.source = list.length > 1 ? { in: list } : list[0]
  }
  if (city) where.city = { contains: city }
  if (state) where.state = { contains: state }
  if (service) where.service = { contains: service }
  if (minPrice || maxPrice) {
    where.price = {}
    if (minPrice) where.price.gte = Number(minPrice)
    if (maxPrice) where.price.lte = Number(maxPrice)
  }
  if (hasMeeting === 'yes') where.meetingDate = { not: null }
  if (hasMeeting === 'no') where.meetingDate = null
  if (hasEmail === 'yes') where.clientEmail = { not: null }
  if (hasEmail === 'no') where.clientEmail = null

  if (search) {
    where.OR = [
      { leadNumber: { contains: search } },
      { clientName: { contains: search } },
      { companyName: { contains: search } },
      { clientPhone: { contains: search } },
      { clientEmail: { contains: search } },
      { alternatePhone: { contains: search } },
      { city: { contains: search } },
      { service: { contains: search } },
      { remark: { contains: search } },
    ]
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59')
  }

  // ---- date helpers (all @db.Date columns, so UTC-midnight boundaries) ----
  const dayRange = (ymd: string) => {
    const d = dateOnly(ymd)
    const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1)
    return { gte: d, lt: next }
  }
  const between = (from: string, to: string) => {
    const r: any = {}
    if (from) r.gte = dateOnly(from)
    if (to) { const t = dateOnly(to); t.setUTCDate(t.getUTCDate() + 1); r.lt = t }
    return r
  }

  if (followUpDate) where.followUpDate = dayRange(followUpDate)
  else if (followUpFrom || followUpTo) where.followUpDate = between(followUpFrom, followUpTo)

  if (callbackDate) where.callbackDate = dayRange(callbackDate)
  else if (callbackFrom || callbackTo) where.callbackDate = between(callbackFrom, callbackTo)

  if (meetingDate) where.meetingDate = dayRange(meetingDate)
  else if (meetingFrom || meetingTo) where.meetingDate = between(meetingFrom, meetingTo)

  // Role-based visibility.
  const and: any[] = []
  let canFilterOthers = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)

  // ---- "Due" quick filter -------------------------------------------------
  // Next action = whichever of followUp / callback / meeting is set. A lead is
  // "due today" if ANY of those three lands today. This is what makes a
  // follow-up you booked yesterday for tomorrow show up in tomorrow's list.
  if (due) {
    const today = dateOnly(new Date())
    const plus = (n: number) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + n); return d }
    let range: any = null
    if (due === 'today') range = { gte: today, lt: plus(1) }
    else if (due === 'tomorrow') range = { gte: plus(1), lt: plus(2) }
    else if (due === 'week') range = { gte: today, lt: plus(7) }
    else if (due === 'overdue') range = { lt: today }

    if (due === 'none') {
      and.push({ followUpDate: null, callbackDate: null, meetingDate: null })
    } else if (range) {
      const notClosed = { status: { notIn: ['CONVERTED', 'CLOSED', 'NOT_INTERESTED'] } }
      and.push(notClosed)
      and.push({
        OR: [
          { followUpDate: range },
          { callbackDate: range },
          { meetingDate: range },
        ],
      })
    }
  }

  if (session.role === 'TELECALLER') {
    and.push({ OR: [{ assignedToId: session.userId }, { createdById: session.userId }] })
  } else if (session.role === 'MARKETING_EXECUTIVE') {
    and.push({ OR: [{ meetingAssignedToId: session.userId }, { createdById: session.userId }] })
  } else if (session.role === 'MANAGER') {
    const team = await getTeamUserIds(session.userId)
    and.push({
      OR: [
        { assignedToId: { in: team.userIds } },
        { createdById: { in: team.userIds } },
        { meetingAssignedToId: { in: team.userIds } },
      ],
    })
  } else if (session.role === 'EMPLOYEE') {
    const team = await getTeamUserIds(session.userId)
    if (!team.canSeeTeam) return successResponse([], 0)
    canFilterOthers = true
    and.push({
      OR: [
        { assignedToId: { in: team.userIds } },
        { createdById: { in: team.userIds } },
        { meetingAssignedToId: { in: team.userIds } },
      ],
    })
  }
  // ADMIN, SUPER_ADMIN see all (respecting filters)

  if (assignedToId && canFilterOthers) and.push({ assignedToId })
  if (meetingAssignedToId && canFilterOthers) and.push({ meetingAssignedToId })
  if (createdById && canFilterOthers) and.push({ createdById })

  if (and.length) where.AND = and

  // ---- Sorting ------------------------------------------------------------
  // 'nextaction' (default) = soonest pending action first. A lead you set to
  // ring/follow-up tomorrow therefore floats to the top of tomorrow's list.
  let orderBy: any
  switch (sortBy) {
    case 'created':
      orderBy = { createdAt: 'desc' }; break
    case 'oldest':
      orderBy = { createdAt: 'asc' }; break
    case 'updated':
      orderBy = { updatedAt: 'desc' }; break
    case 'name':
      orderBy = { clientName: 'asc' }; break
    case 'followup':
      orderBy = [
        { meetingDate: { sort: 'desc', nulls: 'last' } },
        { followUpDate: { sort: 'desc', nulls: 'last' } },
      ]; break
    case 'nextaction':
      orderBy = [
        { followUpDate: { sort: 'asc', nulls: 'last' } },
        { callbackDate: { sort: 'asc', nulls: 'last' } },
        { meetingDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ]; break
    default:
      orderBy = { createdAt: 'desc' }
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where, skip, take: limit,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true, phone: true } },
        meetingAssignedTo: { select: { id: true, name: true, role: true, phone: true } },
        _count: { select: { activities: true, proposals: true } },
      },
      orderBy,
    }),
    prisma.lead.count({ where }),
  ])

  // Serial number, continuous across pages (page 2 starts at 21, etc.)
  const withSerial = leads.map((l, i) => ({ ...l, serialNo: skip + i + 1 }))
  return successResponse(withSerial, total)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TELECALLER', 'MARKETING_EXECUTIVE'].includes(session.role)) {
    return errorResponse('Forbidden', 403)
  }

  const body = await req.json()
  const {
    companyName, clientName, clientPhone, clientEmail, alternatePhone,
    link, address, city, state, source, service, productPitched, price,
    status, remark, notes, followUpDate, followUpTime,
    callbackDate, callbackTime,
    assignedToId,
  } = body

  if (!clientName || !clientPhone) return errorResponse('Client name and phone are required')

  const finalStatus = status && VALID_STATUSES.includes(status) ? status : 'NEW'

  try {
    // Who gets this lead if nobody explicitly picked an assignee?
    // - Telecaller creating their own lead → assign to themselves.
    // - MANAGER (the telecalling TL — see "My Leads" / proposal-edit
    //   elsewhere in the app, which already treat MANAGER as a working
    //   telecaller) adding a lead themselves → also assign to themselves.
    //   Previously this fell into the "everyone else" branch below, which
    //   defaults to the *oldest active Admin in the whole system* — so
    //   every Manager-added lead silently landed on that one fixed admin
    //   account instead of the person who actually created it.
    // - Admin/Marketing Executive adding a lead manually without picking a
    //   telecaller → default to an Admin, not to themselves — self-assigning
    //   would incorrectly make them "the telecaller" on the lead (Marketing
    //   Executives track their own work via meetingAssignedToId instead).
    let finalAssigneeId: string = assignedToId || ''
    if (!finalAssigneeId) {
      if (session.role === 'TELECALLER' || session.role === 'MANAGER') {
        finalAssigneeId = session.userId
      } else {
        const defaultAdmin = await prisma.user.findFirst({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true },
          orderBy: { createdAt: 'asc' },
        })
        finalAssigneeId = defaultAdmin?.id || session.userId
      }
    }

    // leadNumber is derived from the current max — under concurrent
    // creates there's a small race window, so retry once with a freshly
    // generated number if we hit a collision.
    let lead
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        lead = await prisma.lead.create({
          data: {
            leadNumber: await generateLeadNumber(),
            companyName: companyName || null,
            clientName,
            clientPhone,
            clientEmail: clientEmail ? String(clientEmail).toLowerCase() : null,
            alternatePhone: alternatePhone || null,
            link: link || null,
            address: address || null,
            city: city || null,
            state: state || null,
            source: source || 'WEBSITE',
            service: service || null,
            productPitched: productPitched || null,
            price: price ? Number(price) : null,
            status: finalStatus,
            remark: remark || null,
            notes: notes || null,
            followUpDate: followUpDate ? new Date(followUpDate) : null,
            followUpTime: followUpTime || null,
            callbackDate: callbackDate ? new Date(callbackDate) : null,
            callbackTime: callbackTime || null,
            createdById: session.userId,
            assignedToId: finalAssigneeId,
          },
          include: {
            createdBy: { select: { name: true } },
            assignedTo: { select: { name: true } },
          },
        })
        break
      } catch (createErr: any) {
        const isLeadNumberCollision = createErr?.code === 'P2002' && createErr?.meta?.target?.includes?.('leadNumber')
        if (isLeadNumberCollision && attempt < 2) continue
        throw createErr
      }
    }
    if (!lead) return errorResponse('Failed to create lead: could not generate a unique lead number, please retry')

    // Log the "creation" as an activity so timeline starts here
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'STATUS_CHANGE',
        title: 'Lead created',
        description: remark || `New lead added${companyName ? ` for ${companyName}` : ''}`,
        toStatus: finalStatus,
        createdById: session.userId,
      },
    })

    // Log initial assignment
    await prisma.leadAssignmentHistory.create({
      data: {
        leadId: lead.id,
        fromUserId: null,
        toUserId: finalAssigneeId,
        assignedById: session.userId,
        reason: 'Initial assignment on creation',
      },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { leadNumber: lead.leadNumber, status: finalStatus },
    })

    // Notify assignee if the lead was assigned to someone other than the creator
    if (finalAssigneeId && finalAssigneeId !== session.userId) {
      Notifications.leadAssigned(finalAssigneeId, lead.leadNumber, lead.id).catch(() => { })
    }

    return successStatusResponse(lead, 201)
  } catch (e: any) {
    console.error('Lead create error:', e)
    return errorResponse('Failed to create lead: ' + (e.message || 'Unknown'))
  }
}