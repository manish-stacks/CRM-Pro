// src/app/api/mobile/proposals/route.ts
// Proposal builder for the mobile app — same calculation logic as the web
// /api/proposals route so numbers always match the CRM.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { generateProposalNumber, randomToken } from '@/lib/idgen'
import { logFromRequest } from '@/lib/audit'

interface ItemInput { serviceId?: string; serviceName?: string; description?: string; quantity: number; unitPrice: number }

function calculate(items: ItemInput[], discount: number, discountType: string, gstApplicable: boolean, gstRate: number) {
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0)
  const discountAmount = discountType === 'PERCENT' ? subtotal * (discount / 100) : discount
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const gstAmount = gstApplicable ? afterDiscount * (gstRate / 100) : 0
  const totalAmount = afterDiscount + gstAmount
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  }
}

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  // When viewing a specific client's proposals (client detail screen), show
  // ALL proposals for that client — same as the web CRM's client page — so
  // the count/list matches regardless of which staff member created them.
  // Without a clientId (a hypothetical "my proposals" list) we still scope
  // to the logged-in employee's own proposals.
  const where: any = clientId ? { clientId } : { createdById: session.userId }

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })

  return ok(proposals.map(p => ({
    id: p.id,
    proposal_number: p.proposalNumber,
    title: p.title,
    status: p.status,
    final_amount: p.finalAmount,
    valid_until: p.validUntil,
    created_at: p.createdAt,
    items: p.items.map(i => ({
      id: i.id, service_name: i.serviceName, description: i.description,
      quantity: i.quantity, unit_price: i.unitPrice, total: i.total,
    })),
  })))
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const {
    clientId, title, notes, validUntil,
    discount = 0, discountType = 'FIXED',
    gstApplicable = false, gstRate = 18,
    items = [],
  } = body

  if (!clientId) return fail('clientId required')
  if (!title?.trim()) return fail('Title required')
  if (!items.length) return fail('At least one line item required')

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return fail('Client not found', 404)

  const cleanItems: ItemInput[] = items.map((it: any) => ({
    serviceId: it.serviceId || null,
    serviceName: it.serviceName || null,
    description: it.description || it.serviceName || '',
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice) || 0,
  }))
  const totals = calculate(cleanItems, Number(discount) || 0, discountType, !!gstApplicable, Number(gstRate) || 18)

  try {
    const proposal = await prisma.proposal.create({
      data: {
        proposalNumber: await generateProposalNumber(),
        clientId,
        title: title.trim(),
        notes: notes || null,
        discount: Number(discount) || 0,
        discountType,
        gstApplicable: !!gstApplicable,
        gstRate: Number(gstRate) || 18,
        gstAmount: totals.gstAmount,
        subtotal: totals.subtotal,
        totalAmount: totals.totalAmount,
        finalAmount: totals.totalAmount,
        status: 'DRAFT',
        validUntil: validUntil ? new Date(validUntil) : null,
        shareToken: randomToken(32),
        createdById: session.userId,
        items: {
          create: cleanItems.map((it, idx) => ({
            serviceId: it.serviceId || null,
            serviceName: it.serviceName || null,
            description: it.description || '',
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
      userId: session.userId, action: 'CREATE', entityType: 'Proposal', entityId: proposal.id,
      metadata: { via: 'mobile', proposalNumber: proposal.proposalNumber, totalAmount: totals.totalAmount },
    })

    return ok({ id: proposal.id, proposal_number: proposal.proposalNumber, final_amount: proposal.finalAmount })
  } catch (e: any) {
    console.error('Mobile proposal create error:', e)
    return fail('Failed: ' + (e.message || 'Unknown'))
  }
}