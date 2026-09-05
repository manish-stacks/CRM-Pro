// src/app/api/seo-reports/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { Settings } from '@/lib/settings'
import { deleteFile, publicIdFromUrl } from '@/lib/cloudinary'
import { scopedServiceIds } from '../route'

async function loadAndGuard(req: NextRequest, id: string) {
  const session = await getRequestSession(req)
  if (!session) return { error: unauthorizedResponse() }

  const report = await prisma.seoReport.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true, companyName: true, clientName: true, clientCode: true,
          email: true, phone: true, image: true, gmbScreenshot: true, userId: true,
          reportingPersonId: true, marketingPersonId: true, telecallerId: true,
        },
      },
      clientService: { select: { id: true, serviceName: true } },
      createdBy: { select: { id: true, name: true, avatar: true } },
      submittedBy: { select: { id: true, name: true } },
    },
  })
  if (!report) return { error: notFoundResponse('Report') }

  const allowed = await scopedServiceIds(session.userId, session.role)
  if (allowed && report.createdById !== session.userId &&
    !(report.clientServiceId && allowed.includes(report.clientServiceId))) {
    return { error: errorResponse('Forbidden', 403) }
  }
  return { session, report }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadAndGuard(req, id)
  if (r.error) return r.error
  const { report } = r as any

  // Agency logo/name come from admin Settings — never re-uploaded per report.
  // Client logo + GMB screenshot live on the Client (one-time upload, reused
  // by every month's report), so they're merged in over the stored payload.
  const [agencyLogo, agencyName] = await Promise.all([
    Settings.companyLogo(),
    Settings.companyName(),
  ])

  const data = report.data ? JSON.parse(report.data) : {}

  return successResponse({
    ...report,
    agencyLogo,
    agencyName,
    data: {
      ...data,
      clientLogo: report.client?.image || null,
      gmbScreenshot: report.client?.gmbScreenshot || null,
      companyLogo: agencyLogo || null,
    },
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadAndGuard(req, id)
  if (r.error) return r.error
  const { session, report } = r as any

  if (report.status === 'SUBMITTED' && !hasMinRole(session.role, 'ADMIN')) {
    return errorResponse('This report is already submitted and locked', 400)
  }

  const body = await req.json()
  const { title, reportMonth, reportDate, clientServiceId, data, pdfUrl } = body

  const updated = await prisma.seoReport.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(reportMonth !== undefined && { reportMonth }),
      ...(reportDate !== undefined && { reportDate: new Date(reportDate) }),
      ...(clientServiceId !== undefined && { clientServiceId: clientServiceId || null }),
      ...(pdfUrl !== undefined && { pdfUrl }),
      // clientLogo / gmbScreenshot / companyLogo are NOT stored per report —
      // they live on the Client record and admin Settings respectively.
      ...(data !== undefined && {
        data: data
          ? JSON.stringify((({ clientLogo, gmbScreenshot, companyLogo, ...rest }: any) => rest)(data))
          : null,
      }),
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'UPDATE', entityType: 'SeoReport', entityId: id,
  })

  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadAndGuard(req, id)
  if (r.error) return r.error
  const { session, report } = r as any

  if (report.status === 'SUBMITTED' && !hasMinRole(session.role, 'ADMIN')) {
    return errorResponse('Submitted reports can only be deleted by an admin', 400)
  }

  // Remove the mirrored copy from the client portal too
  if (report.clientReportId) {
    await prisma.clientReport.delete({ where: { id: report.clientReportId } }).catch(() => { })
  }

  // Clean up everything this report uploaded to Cloudinary. The client logo and
  // GMB screenshot are deliberately skipped — they belong to the Client and are
  // shared by every month's report.
  const payload = report.data ? (() => { try { return JSON.parse(report.data) } catch { return {} } })() : {}
  const orphanImages: string[] = [payload.gscScreenshot, payload.gaScreenshot].filter(Boolean)
  await Promise.all(
    orphanImages.map(url => {
      const pid = publicIdFromUrl(url)
      return pid ? deleteFile(pid, 'image').catch(() => false) : Promise.resolve(false)
    })
  )
  if (report.pdfUrl) {
    const pid = publicIdFromUrl(report.pdfUrl)
    if (pid) await deleteFile(pid, 'raw').catch(() => false)
  }

  await prisma.seoReport.delete({ where: { id } })

  await logFromRequest(req, {
    userId: session.userId, action: 'DELETE', entityType: 'SeoReport', entityId: id,
  })

  return successResponse({ id })
}
