// src/app/api/seo-reports/[id]/client-assets/route.ts
// Client logo + GMB profile screenshot are uploaded ONCE per client and reused
// by every month's report, so they're stored on the Client record — not inside
// the report payload. Replacing one deletes the old Cloudinary file.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { deleteFile, publicIdFromUrl } from '@/lib/cloudinary'
import { logFromRequest } from '@/lib/audit'
import { scopedServiceIds } from '../../route'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const report = await prisma.seoReport.findUnique({
    where: { id },
    select: {
      clientId: true, clientServiceId: true, createdById: true,
      client: { select: { image: true, gmbScreenshot: true } },
    },
  })
  if (!report) return notFoundResponse('Report')

  const allowed = await scopedServiceIds(session.userId, session.role)
  if (allowed && report.createdById !== session.userId &&
    !(report.clientServiceId && allowed.includes(report.clientServiceId))) {
    return errorResponse('Forbidden', 403)
  }

  const { clientLogo, gmbScreenshot } = await req.json()
  const data: any = {}
  const toDelete: string[] = []

  if (clientLogo !== undefined) {
    if (report.client.image && report.client.image !== clientLogo) toDelete.push(report.client.image)
    data.image = clientLogo || null
  }
  if (gmbScreenshot !== undefined) {
    if (report.client.gmbScreenshot && report.client.gmbScreenshot !== gmbScreenshot) {
      toDelete.push(report.client.gmbScreenshot)
    }
    data.gmbScreenshot = gmbScreenshot || null
  }

  if (!Object.keys(data).length) return errorResponse('Nothing to update')

  const client = await prisma.client.update({
    where: { id: report.clientId },
    data,
    select: { id: true, image: true, gmbScreenshot: true },
  })

  // Old files are dropped only after the DB write succeeds
  await Promise.all(
    toDelete.map(url => {
      const pid = publicIdFromUrl(url)
      return pid ? deleteFile(pid, 'image').catch(() => false) : Promise.resolve(false)
    })
  )

  await logFromRequest(req, {
    userId: session.userId,
    action: 'UPDATE',
    entityType: 'Client',
    entityId: report.clientId,
    changes: data,
    metadata: { via: 'seo-report', reportId: id },
  })

  return successResponse(client)
}
