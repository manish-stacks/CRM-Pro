// src/app/api/seo-reports/view/[token]/route.ts
// Public "view SEO report" endpoint — no login required, the unguessable
// shareToken is the access control (mirrors /api/proposals/view/[token]).
// Returns the report's meta + saved builder data so the public page can
// render the PDF client-side with jsPDF — nothing is ever uploaded/stored.
//
// clientLogo / gmbScreenshot / companyLogo are NOT part of the saved
// report.data blob — they live on the Client record (logo, gmb screenshot,
// re-used every month) and admin Settings (agency logo), and the
// authenticated GET /api/seo-reports/[id] route merges them in over the
// stored payload. This route has to do the exact same merge, or the public
// PDF silently renders with every image missing.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'
import { BRAND } from '@/lib/branding'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const report = await prisma.seoReport.findFirst({
    where: { shareToken: token },
    include: {
      client: { select: { companyName: true, image: true, gmbScreenshot: true } },
      clientService: { select: { serviceName: true } },
    },
  })
  if (!report) return errorResponse('Report not found', 404)

  const agencyLogo = await Settings.companyLogo()
  const parsed = report.data ? (() => { try { return JSON.parse(report.data) } catch { return {} } })() : {}

  return successResponse({
    meta: {
      businessName: report.client?.companyName || '',
      agencyName: BRAND.name,
      reportMonth: report.reportMonth || '',
      serviceName: report.clientService?.serviceName || null,
    },
    data: {
      ...parsed,
      clientLogo: report.client?.image || null,
      gmbScreenshot: report.client?.gmbScreenshot || null,
      companyLogo: agencyLogo || null,
    },
    title: report.title,
  })
}

