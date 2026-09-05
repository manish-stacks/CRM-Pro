// src/app/api/seo-reports/[id]/submit/route.ts
// Submit a built SEO report:
//   1. lock it (status = SUBMITTED)
//   2. mirror it into ClientReport so it appears on the client portal dashboard
//   3. email the client a link
//   4. WhatsApp the client a link
//   5. push + in-app notify the client and the internal staff on the account
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'
import { sendWhatsapp } from '@/lib/whatsapp'
import { sendPushToClients } from '@/lib/push'
import { Notifications } from '@/lib/notify'
import { scopedServiceIds } from '../../route'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const body = await req.json().catch(() => ({}))
  const { pdfUrl, fileSize, notifyEmail = true, notifyWhatsapp = true, message } = body

  const report = await prisma.seoReport.findUnique({
    where: { id },
    include: {
      client: true,
      clientService: { select: { id: true, serviceName: true } },
    },
  })
  if (!report) return notFoundResponse('Report')
  if (report.status === 'SUBMITTED') return errorResponse('Already submitted')

  const allowed = await scopedServiceIds(session.userId, session.role)
  if (allowed && report.createdById !== session.userId &&
    !(report.clientServiceId && allowed.includes(report.clientServiceId))) {
    return errorResponse('Forbidden', 403)
  }

  const finalPdfUrl = pdfUrl || report.pdfUrl
  if (!finalPdfUrl) return errorResponse('Generate the PDF before submitting')

  const client = report.client
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/client-portal/reports`

  // ---- 2. mirror into the client portal reports feed ----
  const mirrored = await prisma.clientReport.create({
    data: {
      clientId: client.id,
      clientServiceId: report.clientServiceId,
      title: report.title,
      description: message || `SEO + GMB performance report for ${report.reportMonth}.`,
      reportType: 'PDF',
      fileUrl: finalPdfUrl,
      fileType: 'application/pdf',
      fileSize: fileSize ? Number(fileSize) : null,
      reportPeriod: report.reportMonth,
      reportDate: report.reportDate,
      uploadedById: session.userId,
    },
  })

  const updated = await prisma.seoReport.update({
    where: { id },
    data: {
      status: 'SUBMITTED',
      pdfUrl: finalPdfUrl,
      clientReportId: mirrored.id,
      submittedAt: new Date(),
      submittedById: session.userId,
    },
  })

  // ---- 3. email ----
  if (notifyEmail && client.email) {
    const html = wrapEmailHtml(
      report.title,
      `<p>Dear ${client.clientName},</p>
       <p>Your <b>SEO + GMB performance report</b> for <b>${report.reportMonth}</b> is now available.</p>
       ${message ? `<p>${message}</p>` : ''}
       <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
         <tr><td><b>Report No.</b></td><td>${report.reportNumber}</td></tr>
         <tr><td><b>Period</b></td><td>${report.reportMonth}</td></tr>
         ${report.clientService ? `<tr><td><b>Service</b></td><td>${report.clientService.serviceName}</td></tr>` : ''}
       </table>
       <p>You can view or download it any time from your client dashboard.</p>
       <p style="font-size:13px;color:#555">Direct PDF link: <a href="${finalPdfUrl}">${finalPdfUrl}</a></p>`,
      'Open My Dashboard',
      portalUrl
    )
    sendMail({
      to: client.email,
      subject: `${report.title} — ${report.reportMonth}`,
      html,
      referenceType: 'SEO_REPORT',
      referenceId: report.id,
    }).catch(() => { })
  }

  // ---- 4. whatsapp ----
  if (notifyWhatsapp && client.phone) {
    sendWhatsapp({
      toPhone: client.phone,
      template: 'hbs_client_report_uploaded',
      params: {
        clientName: client.clientName,
        reportTitle: `${report.title} (${report.reportMonth})`,
        downloadUrl: finalPdfUrl,
      },
      referenceType: 'SEO_REPORT',
      referenceId: report.id,
    }).catch(() => { })
  }

  // ---- 5. push + in-app ----
  sendPushToClients([client.id], {
    title: 'New SEO Report',
    body: `${report.reportMonth} report is ready to view`,
    data: { screen: 'Reports', reportId: mirrored.id, link: '/client-portal/reports' },
  }).catch(() => { })

  const staff = new Set<string>()
    ;[client.reportingPersonId, client.marketingPersonId, client.telecallerId].forEach(x => x && staff.add(x))
  staff.delete(session.userId)
  if (staff.size) {
    Notifications.reportUploaded(Array.from(staff), client.companyName, report.title, client.id).catch(() => { })
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'SeoReport',
    entityId: id,
    metadata: { action: 'SUBMIT', clientId: client.id, reportMonth: report.reportMonth },
  })

  return successResponse({ ...updated, clientReportId: mirrored.id, portalUrl })
}
