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

const VALID_STATUSES = ['NEW', 'NOT_INTERESTED', 'FOLLOW_UP', 'RINGING', 'MEETING_SCHEDULED', 'CALLBACK', 'CONVERTED', 'CLOSED']

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const assignedToId = searchParams.get('assignedToId')
  const meetingAssignedToId = searchParams.get('meetingAssignedToId')
  const createdById = searchParams.get('createdById')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const followUpDate = searchParams.get('followUpDate') // YYYY-MM-DD
  const meetingDate = searchParams.get('meetingDate')

  const where: any = {}
  if (status) where.status = status
  if (source) where.source = source

  if (search) {
    where.OR = [
      { leadNumber: { contains: search } },
      { clientName: { contains: search } },
      { companyName: { contains: search } },
      { clientPhone: { contains: search } },
      { clientEmail: { contains: search } },
    ]
  }
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo)   where.createdAt.lte = new Date(dateTo + 'T23:59:59')
  }
  if (followUpDate) {
    const d = dateOnly(followUpDate)
    const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1)
    where.followUpDate = { gte: d, lt: next }
  }
  if (meetingDate) {
    const d = dateOnly(meetingDate)
    const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1)
    where.meetingDate = { gte: d, lt: next }
  }

  // Role-based visibility
  if (session.role === 'TELECALLER') {
    // Sees only own assigned leads
    where.assignedToId = session.userId
  } else if (session.role === 'MARKETING_EXECUTIVE') {
    // Sees only meetings assigned to them
    where.meetingAssignedToId = session.userId
  } else if (session.role === 'EMPLOYEE') {
    // Regular employees don't see any leads
    return successResponse([], 0)
  }
  // MANAGER, ADMIN, SUPER_ADMIN see all (respecting filters)

  // Admin can filter further
  if (assignedToId && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
    where.assignedToId = assignedToId
  }
  if (meetingAssignedToId && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
    where.meetingAssignedToId = meetingAssignedToId
  }
  if (createdById && ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(session.role)) {
    where.createdById = createdById
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
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ])
  return successResponse(leads, total)
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
    assignedToId,
  } = body

  if (!clientName || !clientPhone) return errorResponse('Client name and phone are required')

  const finalStatus = status && VALID_STATUSES.includes(status) ? status : 'NEW'

  try {
    // Who gets this lead if nobody explicitly picked an assignee?
    // - Telecaller creating their own lead → assign to themselves.
    // - Anyone else (Admin/Manager/Marketing adding a lead manually without
    //   picking a telecaller) → default to an Admin, not to themselves —
    //   a Manager/Marketing Executive self-assigning would incorrectly make
    //   them "the telecaller" on the lead.
    let finalAssigneeId: string = assignedToId || ''
    if (!finalAssigneeId) {
      if (session.role === 'TELECALLER') {
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
      Notifications.leadAssigned(finalAssigneeId, lead.leadNumber, lead.id).catch(() => {})
    }

    return successStatusResponse(lead, 201)
  } catch (e: any) {
    console.error('Lead create error:', e)
    return errorResponse('Failed to create lead: ' + (e.message || 'Unknown'))
  }
}
