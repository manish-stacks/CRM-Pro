// src/app/api/clients/route.ts
// Phase 4: enhanced client management. Admin + Marketing Executive can add.
// Optional `sendWelcome: true` triggers portal activation + email + WhatsApp.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { generateClientCode } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'
import { activateClientPortal } from '@/lib/welcomeFlow'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const search = searchParams.get('search')
  const status = searchParams.get('status')
  const state = searchParams.get('state')
  const assignedToMe = searchParams.get('assignedToMe')
  // ---- New filters ----
  const marketingPersonId = searchParams.get('marketingPersonId')  // exec name-wise
  const telecallerId = searchParams.get('telecallerId')
  const dateFrom = searchParams.get('dateFrom')                    // onboarding date-wise
  const dateTo = searchParams.get('dateTo')
  const dateField = searchParams.get('dateField') || 'createdAt'   // createdAt | onboardingDate
  const serviceName = searchParams.get('serviceName')              // service-wise
  const serviceCatalogId = searchParams.get('serviceCatalogId')
  const expiry = searchParams.get('expiry')                        // expired|7|15|30|60|90|active|none

  const where: any = {}
  if (status) where.status = status
  if (state) where.state = state
  if (marketingPersonId) where.marketingPersonId = marketingPersonId
  if (telecallerId) where.telecallerId = telecallerId

  if (dateFrom || dateTo) {
    const field = dateField === 'onboardingDate' ? 'onboardingDate' : 'createdAt'
    where[field] = {}
    if (dateFrom) where[field].gte = new Date(dateFrom)
    if (dateTo) where[field].lte = new Date(dateTo + 'T23:59:59')
  }

  // ---- Service + expiry filters (Client -> services relation) ----
  const svc: any = {}
  if (serviceName) svc.serviceName = { contains: serviceName }
  if (serviceCatalogId) svc.serviceCatalogId = serviceCatalogId

  if (expiry) {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    if (expiry === 'expired') {
      svc.expiryDate = { lt: todayStart }
    } else if (expiry === 'none') {
      svc.expiryDate = null
    } else if (expiry === 'active') {
      svc.expiryDate = { gte: todayStart }
      svc.status = 'ACTIVE'
    } else {
      const days = parseInt(expiry)
      if (!isNaN(days)) {
        const until = new Date(todayStart); until.setDate(until.getDate() + days); until.setHours(23, 59, 59, 999)
        svc.expiryDate = { gte: todayStart, lte: until }
      }
    }
  }
  if (Object.keys(svc).length) where.services = { some: svc }

  if (search) {
    where.OR = [
      { clientCode: { contains: search } },
      { clientName: { contains: search } },
      { companyName: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ]
  }

  // Role-based visibility
  if (session.role === 'TELECALLER') {
    where.telecallerId = session.userId
  } else if (session.role === 'MARKETING_EXECUTIVE') {
    where.marketingPersonId = session.userId
  } else if (session.role === 'EMPLOYEE') {
    // Employees see clients where they're on a project team (Phase 5)
    // For now, empty
    return successResponse([], 0)
  }

  if (assignedToMe === 'true' && hasMinRole(session.role, 'MANAGER')) {
    where.OR = [
      ...(where.OR || []),
      { assignedToId: session.userId },
      { telecallerId: session.userId },
      { marketingPersonId: session.userId },
      { reportingPersonId: session.userId },
    ]
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where, skip, take: limit,
      include: {
        telecaller: { select: { id: true, name: true } },
        marketingPerson: { select: { id: true, name: true } },
        // For the expiry column — service expiring soonest goes on top
        services: {
          select: { id: true, serviceName: true, status: true, expiryDate: true, amount: true },
          orderBy: { expiryDate: 'asc' },
          take: 5,
        },
        _count: { select: { services: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.count({ where }),
  ])
  return successResponse(clients, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  // Admin/Manager, Marketing Executive, and Telecaller can all create clients manually
  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE', 'TELECALLER'].includes(session.role)) {
    return errorResponse('Forbidden', 403)
  }

  const body = await req.json()
  const {
    companyName, clientName, phone, altPhone, email,
    address, state, city, pincode,
    gstApplicable, gstNo, onboardingDate, status,
    telecallerId, marketingPersonId, reportingPersonId, assignedToId,
    salesPersonId, telesalesId, // legacy aliases
    leadId, image,
    sendWelcome = false,
    services = [],
  } = body

  if (!companyName || !clientName || !phone) return errorResponse('Company, client name and phone required')

  try {
    const client = await prisma.client.create({
      data: {
        clientCode: await generateClientCode(),
        companyName, clientName, phone,
        altPhone: altPhone || null,
        email: email ? String(email).toLowerCase() : null,
        address: address || null,
        state: state || null,
        city: city || null,
        pincode: pincode || null,
        gstApplicable: !!gstApplicable && gstApplicable !== 'false',
        gstNo: gstNo || null,
        onboardingDate: onboardingDate ? new Date(onboardingDate) : new Date(),
        status: status || 'ACTIVE',
        image: image || null,
        assignedToId: assignedToId || null,
        marketingPersonId: marketingPersonId || salesPersonId ||
          (session.role === 'MARKETING_EXECUTIVE' ? session.userId : null),
        telecallerId: telecallerId || telesalesId ||
          (session.role === 'TELECALLER' ? session.userId : null),
        reportingPersonId: reportingPersonId || null,
        leadId: leadId || null,
        createdById: session.userId,
        services: services.length ? {
          create: services.map((s: any) => ({
            serviceName: s.serviceName,
            description: s.description || null,
            category: s.category || null,
            departmentId: s.departmentId || null,
            startDate: s.startDate ? new Date(s.startDate) : new Date(),
            expiryDate: s.expiryDate ? new Date(s.expiryDate) : null,
            amount: Number(s.amount) || 0,
            billingCycle: s.billingCycle || 'ONE_TIME',
            status: 'ACTIVE',
          })),
        } : undefined,
      },
      include: {
        services: true,
        telecaller: { select: { name: true } },
        marketingPerson: { select: { name: true } },
      },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Client',
      entityId: client.id,
      metadata: { clientCode: client.clientCode, sendWelcome },
    })

    // Fire welcome flow if asked (best-effort, doesn't block)
    let welcomeResult = null
    if (sendWelcome) {
      try {
        welcomeResult = await activateClientPortal(client.id)
      } catch (e: any) {
        welcomeResult = { error: e?.message || 'Welcome failed' }
      }
    }

    return successResponse({ client, welcome: welcomeResult })
  } catch (e: any) {
    console.error('Client create error:', e)
    return errorResponse('Failed to create client: ' + (e.message || 'Unknown'))
  }
}
