// src/app/api/letters/[id]/send/route.ts
// Emails the generated letter directly to the employee's registered email.
// The email contains a "View / Download Letter" button that opens the
// server-rendered PDF (GET /api/letters/[id]/pdf) — an A4, letterhead-branded
// PDF with the header/footer repeating on every page.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from '@/lib/api'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'
import { logActivity } from '@/lib/audit'

const TYPE_LABEL: Record<string, string> = {
  OFFER: 'Offer Letter',
  SALARY_REVISION: 'Salary Revision Letter',
  RELIEVING_EXPERIENCE: 'Relieving & Experience Letter',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  if (!hasMinRole(session.role, 'ADMIN')) return forbiddenResponse()

  const letter = await prisma.letter.findUnique({
    where: { id },
    include: { employee: { include: { user: { select: { name: true, email: true } } } } },
  })
  if (!letter) return notFoundResponse('Letter')

  const recipientEmail = letter.employee.user.email
  if (!recipientEmail) return errorResponse('This employee has no email on file')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const viewUrl = `${baseUrl}/api/letters/${id}/pdf`
  const label = TYPE_LABEL[letter.type] || 'Letter'

  const body = `
    <p>Hi <b>${letter.employee.user.name}</b>,</p>
    <p>Please find your <b>${label}</b> ready for you. Click the button below to view or download the PDF.</p>
  `

  const result = await sendMail({
    to: recipientEmail,
    subject: `${label} — ${letter.employee.user.name}`,
    html: wrapEmailHtml(label, body, 'View / Download Letter', viewUrl),
    referenceType: 'LETTER',
    referenceId: id,
  })

  if (!result.success) return errorResponse(result.error || 'Failed to send email', 500)

  await logActivity({
    userId: session.userId,
    action: 'SEND',
    entityType: 'Letter',
    entityId: id,
    metadata: { to: recipientEmail, type: letter.type },
  })

  return successResponse({ emailSent: true, sentTo: recipientEmail })
}
