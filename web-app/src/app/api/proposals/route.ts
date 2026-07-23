// src/app/api/proposals/route.ts
// Phase 4: proper proposal builder — line items, GST toggle, discount (fixed/percent)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getRequestSession } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { generateProposalNumber, randomToken } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'

interface ProposalItemInput {
  serviceId?: string
  serviceName?: string
  description: string
  quantity: number
  unitPrice: number
}

function calculate(items: ProposalItemInput[], discount: number, discountType: string, gstApplicable: boolean, gstRate: number) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0)
  const discountAmount = discountType === 'PERCENT' ? subtotal * (discount / 100) : discount
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const gstAmount = gstApplicable ? afterDiscount * (gstRate / 100) : 0
  const totalAmount = afterDiscount + gstAmount
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    finalAmount: Math.round(totalAmount * 100) / 100,
  }
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const { skip, limit } = getPaginationParams(searchParams)
  const status = searchParams.get('status')
  const clientId = searchParams.get('clientId')
  const leadId = searchParams.get('leadId')
  const search = searchParams.get('search')

  const where: any = {}
  if (status) where.status = status
  if (clientId) where.clientId = clientId
  if (leadId) where.leadId = leadId

  const andClauses: any[] = []
  if (search) {
    andClauses.push({
      OR: [
        { proposalNumber: { contains: search } },
        { title: { contains: search } },
      ],
    })
  }

  // Role visibility — Telecaller (creates proposals for their leads) and
  // Marketing Executive (needs to see the proposal for context on the deal
  // they're closing) can both see: proposals they created themselves, OR
  // proposals tied to a lead/client they're assigned to.
  if (session.role === 'TELECALLER' || session.role === 'MARKETING_EXECUTIVE') {
    andClauses.push({
      OR: [
        { createdById: session.userId },
        { lead: { is: { assignedToId: session.userId } } },
        { lead: { is: { meetingAssignedToId: session.userId } } },
        { client: { is: { telecallerId: session.userId } } },
        { client: { is: { marketingPersonId: session.userId } } },
      ],
    })
  } else if (session.role === 'EMPLOYEE') {
    return successResponse([], 0)
  }
  if (andClauses.length) where.AND = andClauses

  const [proposals, total] = await Promise.all([
    prisma.proposal.findMany({
      where, skip, take: limit,
      include: {
        client: { select: { id: true, clientCode: true, clientName: true, companyName: true } },
        lead:   { select: { id: true, leadNumber: true, clientName: true, companyName: true } },
        createdBy: { select: { id: true, name: true, role: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.proposal.count({ where }),
  ])
  return successResponse(proposals, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  // Only Admin, the telecalling head (MANAGER) and Marketing Executives may
  // raise a proposal. Telecallers pass the lead up instead of quoting directly.
  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(session.role)) {
    return errorResponse('Forbidden', 403)
  }

  const body = await req.json()
  const {
    title, leadId, clientId, notes, terms,
    validUntil,
    discount = 0,
    discountType = 'FIXED',       // FIXED or PERCENT
    gstApplicable = false,
    gstRate = 18,
    items = [],
  } = body

  if (!title) return errorResponse('Title required')
  if (!leadId) return errorResponse('leadId required — proposals are created from a Lead')
  if (!items.length) return errorResponse('At least one line item required')

  // Auto-compute totals for each item + rollup
  const cleanItems: ProposalItemInput[] = items.map((it: any) => ({
    serviceId: it.serviceId || null,
    serviceName: it.serviceName || null,
    description: it.description || '',
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice) || 0,
  }))
  const totals = calculate(cleanItems, Number(discount) || 0, discountType, !!gstApplicable, Number(gstRate) || 18)

  try {
    const proposal = await prisma.proposal.create({
      data: {
        proposalNumber: await generateProposalNumber(),
        leadId: leadId || null,
        clientId: clientId || null,
        title,
        notes: notes || null,
        terms: terms || null,
        discount: Number(discount) || 0,
        discountType,
        gstApplicable: !!gstApplicable,
        gstRate: Number(gstRate) || 18,
        gstAmount: totals.gstAmount,
        subtotal: totals.subtotal,
        totalAmount: totals.totalAmount,
        finalAmount: totals.finalAmount,
        status: 'DRAFT',
        validUntil: validUntil ? new Date(validUntil) : null,
        shareToken: randomToken(32),
        createdById: session.userId,
        items: {
          create: cleanItems.map((it, idx) => ({
            serviceId: it.serviceId || null,
            serviceName: it.serviceName || null,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.quantity * it.unitPrice,
            order: idx,
          })),
        },
      },
      include: { items: true },
    })

    await logFromRequest(req, {
      userId: session.userId,
      action: 'CREATE',
      entityType: 'Proposal',
      entityId: proposal.id,
      metadata: { proposalNumber: proposal.proposalNumber, totalAmount: totals.totalAmount },
    })

    return successStatusResponse(proposal, 201)
  } catch (e: any) {
    console.error('Proposal create error:', e)
    return errorResponse('Failed: ' + (e.message || 'Unknown'))
  }
}
