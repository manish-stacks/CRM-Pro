// src/app/api/proposals/[id]/convert-to-invoice/route.ts
// Convert an ACCEPTED proposal into an Invoice.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { generateInvoiceNumber, generateClientCode } from '@/lib/idgen'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { dueDays = 15 } = await req.json()

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { items: true, client: true, lead: true },
  })
  if (!proposal) return notFoundResponse('Proposal')

  if (!['ACCEPTED', 'VIEWED', 'SENT'].includes(proposal.status)) {
    return errorResponse('Only accepted/sent proposals can be converted to invoice')
  }

  // If proposal has no client but has a lead → create client stub
  let clientId = proposal.clientId
  if (!clientId && proposal.lead) {
    const c = await prisma.client.create({
      data: {
        clientCode: await generateClientCode(),
        companyName: proposal.lead.companyName || proposal.lead.clientName,
        clientName: proposal.lead.clientName,
        phone: proposal.lead.clientPhone,
        email: proposal.lead.clientEmail,
        address: proposal.lead.address,
        city: proposal.lead.city,
        state: proposal.lead.state,
        leadId: proposal.lead.id,
        status: 'ACTIVE',
        onboardingDate: new Date(),
        createdById: session.userId,
        portalPasswordSet: false,
      },
    })
    clientId = c.id
    await prisma.proposal.update({ where: { id }, data: { clientId } })
  }

  if (!clientId) return errorResponse('No client linked')

  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + dueDays)

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await generateInvoiceNumber(),
      clientId,
      proposalId: id,
      subtotal: proposal.subtotal,
      discount: proposal.discount,
      discountType: proposal.discountType,
      gstApplicable: proposal.gstApplicable,
      gstRate: proposal.gstRate,
      gstAmount: proposal.gstAmount,
      totalAmount: proposal.finalAmount,
      paidAmount: 0,
      dueAmount: proposal.finalAmount,
      status: 'PENDING',
      dueDate,
      notes: `Auto-generated from Proposal ${proposal.proposalNumber}`,
      terms: proposal.terms,
      items: {
        create: proposal.items.map((it, idx) => ({
          serviceName: it.serviceName,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          order: idx,
        })),
      },
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CONVERT_TO_INVOICE',
    entityType: 'Proposal',
    entityId: id,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
  })

  return successResponse(invoice)
}
