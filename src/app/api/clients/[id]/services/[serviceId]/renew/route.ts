// src/app/api/clients/[id]/services/[serviceId]/renew/route.ts
// Renew a client service — extends expiryDate and (optionally) generates an invoice.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { generateInvoiceNumber } from '@/lib/idgen'
import { sendWhatsapp } from '@/lib/whatsapp'

// Compute new expiry given current + cycle
function addCycle(current: Date, cycle: string): Date {
  const d = new Date(current)
  switch (cycle) {
    case 'MONTHLY':    d.setMonth(d.getMonth() + 1); break
    case 'QUARTERLY':  d.setMonth(d.getMonth() + 3); break
    case 'YEARLY':     d.setFullYear(d.getFullYear() + 1); break
    default:           d.setFullYear(d.getFullYear() + 1)
  }
  return d
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  const { id, serviceId } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MARKETING_EXECUTIVE'].includes(session.role)) {
    return errorResponse('Forbidden', 403)
  }

  const {
    newExpiryDate,  // optional; else compute from billingCycle
    amount,         // optional; else reuse service amount
    generateInvoice = true,
    dueDays = 15,
  } = await req.json()

  const svc = await prisma.clientService.findUnique({
    where: { id: serviceId },
    include: { client: true },
  })
  if (!svc || svc.clientId !== id) return notFoundResponse('Service')

  // Compute new expiry
  const currentExpiry = svc.expiryDate || new Date()
  const nextExpiry = newExpiryDate
    ? new Date(newExpiryDate)
    : addCycle(currentExpiry < new Date() ? new Date() : currentExpiry, svc.billingCycle)

  const renewAmount = amount !== undefined ? Number(amount) : svc.amount

  const updated = await prisma.clientService.update({
    where: { id: serviceId },
    data: {
      expiryDate: nextExpiry,
      lastRenewedAt: new Date(),
      status: 'ACTIVE',
    },
  })

  // Optionally generate an invoice
  let invoice = null
  if (generateInvoice && renewAmount > 0) {
    const gstApplicable = svc.client.gstApplicable
    const subtotal = renewAmount
    const gstAmount = gstApplicable ? Math.round(subtotal * 0.18) : 0
    const totalAmount = subtotal + gstAmount
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + dueDays)

    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(),
        clientId: id,
        subtotal, gstApplicable, gstRate: 18, gstAmount, totalAmount,
        paidAmount: 0, dueAmount: totalAmount,
        status: 'PENDING',
        dueDate,
        notes: `Renewal of ${svc.serviceName}. Valid until ${nextExpiry.toLocaleDateString('en-IN')}.`,
        items: {
          create: [{
            serviceName: svc.serviceName,
            description: `Renewal — ${svc.billingCycle}`,
            quantity: 1, unitPrice: renewAmount, total: renewAmount,
            order: 0,
          }],
        },
      },
    })
  }

  // WhatsApp confirmation
  if (svc.client.phone) {
    sendWhatsapp({
      toPhone: svc.client.phone,
      template: 'hbs_service_renewed',
      params: {
        clientName: svc.client.clientName,
        serviceName: svc.serviceName,
        newExpiryDate: nextExpiry.toLocaleDateString('en-IN'),
      },
      referenceType: 'CLIENT_SERVICE',
      referenceId: serviceId,
    }).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'RENEW',
    entityType: 'ClientService',
    entityId: serviceId,
    metadata: { newExpiryDate: nextExpiry, amount: renewAmount, invoiceId: invoice?.id },
  })

  return successResponse({ service: updated, invoice })
}