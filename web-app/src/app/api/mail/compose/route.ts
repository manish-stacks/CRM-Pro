// src/app/api/mail/compose/route.ts
// Lets an admin/HR send a one-off custom email (to an employee or any
// address) instead of only relying on system-triggered templates. Every
// send is logged via sendMail()'s EmailLog, tagged referenceType 'MANUAL' so
// this page can show a "recently sent" history.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const logs = await prisma.emailLog.findMany({
    where: { referenceType: 'MANUAL' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return successResponse(logs)
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { to, subject, message, employeeId } = await req.json()
  if (!to || !to.trim()) return errorResponse('Recipient email is required')
  if (!subject || !subject.trim()) return errorResponse('Subject is required')
  if (!message || !message.trim()) return errorResponse('Message is required')

  const html = wrapEmailHtml(subject, `<div style="white-space:pre-wrap;">${message.replace(/</g, '&lt;')}</div>`)

  const result = await sendMail({
    to: to.trim(),
    subject: subject.trim(),
    html,
    referenceType: 'MANUAL',
    referenceId: employeeId || undefined,
  })

  if (!result.success) return errorResponse(result.error || 'Failed to send email', 500)

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'CustomEmail',
    entityId: result.logId,
    metadata: { to, subject },
  })

  return successResponse({ ok: true, logId: result.logId })
}
