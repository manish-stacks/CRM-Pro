// src/app/api/tracker/screenshot/route.ts
// Desktop app posts a captured screenshot here (base64 data URL). Server
// re-validates every admin control (tracking on, employee not exempt,
// within office hours) before storing — so a modified/old desktop client
// can't bypass settings, and toggling something off in Settings takes
// effect on the very next capture, not just at check-in time.
//
// NOTE: this uploads directly via Cloudinary (this codebase's actual
// storage provider — see src/lib/cloudinary.ts). There is no S3/presigned
// upload support here, so this is a single request/response instead of the
// two-step "ticket" dance the old desktop README described.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { Settings } from '@/lib/settings'
import { uploadFile } from '@/lib/cloudinary'
import { isWithinOfficeWindow } from '@/lib/attendanceDate'

const MAX_BYTES = 4 * 1024 * 1024 // 4MB safety cap per screenshot

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const employee = await prisma.employee.findUnique({ where: { userId: session.userId } })
  if (!employee) return errorResponse('No employee record for this account', 404)

  const { sessionId, imageBase64 } = await req.json()
  if (!sessionId || !imageBase64) return errorResponse('sessionId and imageBase64 required')
  if (!imageBase64.startsWith('data:')) return errorResponse('imageBase64 must be a data URL')

  const trackerSession = await prisma.trackerSession.findUnique({ where: { id: sessionId } })
  if (!trackerSession || trackerSession.employeeId !== employee.id || trackerSession.status !== 'ACTIVE') {
    return errorResponse('No active session', 404)
  }

  // Re-check every admin control server-side — never trust the client here.
  const [trackerEnabled, officeHoursOnly, officeStart, officeEnd] = await Promise.all([
    Settings.trackerEnabled(), Settings.trackerOfficeHoursOnly(),
    Settings.officeStartTime(), Settings.officeEndTime(),
  ])
  if (!trackerEnabled) return errorResponse('Tracking disabled by admin', 403)
  if (employee.trackerExempt) return errorResponse('Employee exempt from tracking', 403)
  if (officeHoursOnly && !isWithinOfficeWindow(new Date(), officeStart, officeEnd)) {
    return errorResponse('Outside office hours — screenshot skipped', 403)
  }

  const estimatedBytes = Math.floor(((imageBase64.split(',')[1]) || '').length * 0.75)
  if (estimatedBytes > MAX_BYTES) return errorResponse('Screenshot too large', 413)

  const uploaded = await uploadFile(imageBase64, 'tracker-screenshots', {
    publicId: `tracker_${employee.id}_${Date.now()}`,
  })

  const screenshot = await prisma.trackerScreenshot.create({
    data: {
      sessionId: trackerSession.id,
      employeeId: employee.id,
      url: uploaded.url,
      publicId: uploaded.publicId,
    },
  })

  return successResponse({ screenshot: { id: screenshot.id, capturedAt: screenshot.capturedAt } })
}
