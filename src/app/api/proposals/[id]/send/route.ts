// src/app/api/proposals/[id]/send/route.ts
// Send proposal to client via Email + WhatsApp. Sets status DRAFT → SENT.
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

  const { viaEmail = true, viaWhatsapp = true, customMessage } = await req.json()

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      client: { select: { clientName: true, email: true, phone: true } },
      lead:   { select: { clientName: true, clientEmail: true, clientPhone: true } },
    },
  })
  if (!proposal) return notFoundResponse('Proposal')

  const recipientName  = proposal.client?.clientName || proposal.lead?.clientName || 'Customer'
  const recipientEmail = proposal.client?.email || proposal.lead?.clientEmail
  const recipientPhone = proposal.client?.phone || proposal.lead?.clientPhone

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/proposal/view/${proposal.shareToken}`

  let emailSent = false, whatsappSent = false

  // Email
  if (viaEmail && recipientEmail) {
    const body = `
      <p>Hi <b>${recipientName}</b>,</p>
      <p>Please find your proposal <b>${proposal.proposalNumber}</b> for review.</p>
      <p><b>Total Amount:</b> ₹${proposal.finalAmount.toLocaleString('en-IN')}</p>
      ${customMessage ? `<p>${customMessage}</p>` : ''}
      <p>You can view the full proposal and accept/reject it using the link below:</p>
    `
    const r = await sendMail({
      to: recipientEmail,
      subject: `Proposal ${proposal.proposalNumber} — ${proposal.title}`,
      html: wrapEmailHtml(proposal.title, body, 'View Proposal', shareUrl),
      referenceType: 'PROPOSAL',
      referenceId: id,
    })
    emailSent = r.success
  }

  // WhatsApp
  if (viaWhatsapp && recipientPhone) {
    const r = await sendWhatsapp({
      toPhone: recipientPhone,
      template: 'hbs_proposal_sent',
      params: {
        clientName: recipientName,
        proposalNumber: proposal.proposalNumber,
        amount: `₹${proposal.finalAmount.toLocaleString('en-IN')}`,
        viewUrl: shareUrl,
      },
      referenceType: 'PROPOSAL',
      referenceId: id,
    })
    whatsappSent = r.success
  }

  await prisma.proposal.update({
    where: { id },
    data: {
      status: proposal.status === 'DRAFT' ? 'SENT' : proposal.status,
      emailSentAt: emailSent ? new Date() : proposal.emailSentAt,
      whatsappSentAt: whatsappSent ? new Date() : proposal.whatsappSentAt,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'SEND', entityType: 'Proposal', entityId: id,
    metadata: { emailSent, whatsappSent, shareUrl },
  })

  return successResponse({ emailSent, whatsappSent, shareUrl })
}
