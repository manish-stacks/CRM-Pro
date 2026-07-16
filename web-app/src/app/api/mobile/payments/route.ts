// src/app/api/mobile/payments/route.ts
// Payments Received for the mobile app — same calc/status logic as the web
// /api/payments route, scoped to clients assigned to the logged-in employee
// (marketingPersonId), same as /mobile/invoices and /mobile/clients.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'
import { randomToken } from '@/lib/idgen'

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('clientId')

  const invoiceFilter: any = { client: { marketingPersonId: session.userId } }
  if (clientId) invoiceFilter.clientId = clientId

  const payments = await prisma.payment.findMany({
    where: { invoice: invoiceFilter },
    include: {
      invoice: {
        select: {
          id: true, invoiceNumber: true, totalAmount: true, paidAmount: true,
          dueAmount: true, status: true,
          client: { select: { id: true, clientName: true, companyName: true } },
        },
      },
    },
    orderBy: { paidAt: 'desc' },
  })

  // Har payment ka public receipt link ho — PARTIAL bhi. Missing token bana do.
  await Promise.all(
    payments.filter(p => !p.receiptToken).map(async p => {
      const token = randomToken(32)
      try {
        await prisma.payment.update({ where: { id: p.id }, data: { receiptToken: token } })
        ;(p as any).receiptToken = token
      } catch { /* ignore */ }
    })
  )

  const base = new URL(req.url).origin

  return ok(payments.map(p => ({
    id: p.id,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    paid_at: p.paidAt,
    notes: p.notes,
    source: p.source,
    invoice_id: p.invoiceId,
    invoice_number: p.invoice?.invoiceNumber,
    invoice_total: p.invoice?.totalAmount,
    invoice_due: p.invoice?.dueAmount,
    invoice_status: p.invoice?.status,     // PARTIAL / PAID
    client_id: p.invoice?.client?.id,
    client_name: p.invoice?.client?.companyName || p.invoice?.client?.clientName,
    receipt_token: p.receiptToken,
    receipt_url: p.receiptToken ? `${base}/receipt/view/${p.receiptToken}` : null,
  })))
}

export async function POST(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { invoiceId, amount, method, reference, paidAt, notes, nextDueDate } = body

  if (!invoiceId) return fail('invoiceId required')
  if (!amount || Number(amount) <= 0) return fail('Valid amount required')
  if (!method || !METHODS.includes(method)) return fail('Valid method required')

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, client: { marketingPersonId: session.userId } },
    include: { client: true },
  })
  if (!invoice) return fail('Invoice not found', 404)

  const payAmount = Number(amount)
  const newPaid = invoice.paidAmount + payAmount
  const newDue = Math.max(0, invoice.totalAmount - newPaid)
  const newStatus =
    newPaid >= invoice.totalAmount ? 'PAID' :
    newPaid > 0                    ? 'PARTIAL' :
                                      'PENDING'

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        clientId: invoice.clientId,
        amount: payAmount,
        method,
        reference: reference || null,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        notes: notes || null,
        source: 'MANUAL',
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaid,
        dueAmount: newDue,
        status: newStatus,
        ...(newDue > 0 && nextDueDate ? { dueDate: new Date(nextDueDate) } : {}),
      },
    }),
  ])

  if (invoice.client.phone) {
    sendWhatsapp({
      toPhone: invoice.client.phone,
      template: 'hbs_payment_received',
      params: {
        clientName: invoice.client.clientName,
        amount: `₹${payAmount.toLocaleString('en-IN')}`,
        invoiceNumber: invoice.invoiceNumber,
        paymentMethod: method,
      },
      referenceType: 'PAYMENT',
      referenceId: payment.id,
    }).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId, action: 'RECORD_PAYMENT', entityType: 'Payment', entityId: payment.id,
    metadata: { via: 'mobile', invoiceId, amount: payAmount, method, newStatus },
  })

  const staffIds = [
    invoice.client.telecallerId,
    invoice.client.marketingPersonId,
    invoice.client.reportingPersonId,
  ].filter(Boolean) as string[]
  if (staffIds.length) {
    Notifications.paymentReceived(
      Array.from(new Set(staffIds)),
      invoice.invoiceNumber, payAmount, invoiceId
    ).catch(() => {})
  }

  const base = new URL(req.url).origin
  return ok({
    id: payment.id,
    amount: payment.amount,
    method: payment.method,
    paid_at: payment.paidAt,
    invoice_id: invoiceId,
    invoice_number: invoice.invoiceNumber,
    invoice_status: newStatus,           // PARTIAL / PAID
    invoice_due: newDue,
    receipt_token: payment.receiptToken,
    receipt_url: payment.receiptToken ? `${base}/receipt/view/${payment.receiptToken}` : null,
  })
}
