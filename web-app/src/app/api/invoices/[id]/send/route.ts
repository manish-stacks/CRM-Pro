// src/app/api/invoices/[id]/send/route.ts
// Send invoice via email + WhatsApp
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'
import { sendWhatsapp } from '@/lib/whatsapp'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { viaEmail = true, viaWhatsapp = true } = await req.json()

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { clientName: true, email: true, phone: true } },
    },
  })
  if (!invoice) return notFoundResponse('Invoice')

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/client-portal`
  let emailSent = false, whatsappSent = false

  if (viaEmail && invoice.client.email) {
    const body = `
      <p>Hi <b>${invoice.client.clientName}</b>,</p>
      <p>Your invoice <b>${invoice.invoiceNumber}</b> for <b>₹${invoice.totalAmount.toLocaleString('en-IN')}</b> is ready.</p>
      ${invoice.dueDate ? `<p><b>Due Date:</b> ${new Date(invoice.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>` : ''}
      <p>You can view the invoice and pay via your client portal.</p>
    `
    const r = await sendMail({
      to: invoice.client.email,
      subject: `Invoice ${invoice.invoiceNumber} — ${process.env.COMPANY_NAME || 'HBS'}`,
      html: wrapEmailHtml(`Invoice ${invoice.invoiceNumber}`, body, 'Pay Now', portalUrl),
      referenceType: 'INVOICE',
      referenceId: id,
    })
    emailSent = r.success
  }

  if (viaWhatsapp && invoice.client.phone) {
    const r = await sendWhatsapp({
      toPhone: invoice.client.phone,
      template: 'hbs_invoice_generated',
      params: {
        clientName: invoice.client.clientName,
        invoiceNumber: invoice.invoiceNumber,
        amount: `₹${invoice.totalAmount.toLocaleString('en-IN')}`,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'On receipt',
        payUrl: portalUrl,
      },
      referenceType: 'INVOICE',
      referenceId: id,
    })
    whatsappSent = r.success
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      emailSentAt: emailSent ? new Date() : invoice.emailSentAt,
      whatsappSentAt: whatsappSent ? new Date() : invoice.whatsappSentAt,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'SEND', entityType: 'Invoice', entityId: id,
    metadata: { emailSent, whatsappSent },
  })

  return successResponse({ emailSent, whatsappSent })
}
