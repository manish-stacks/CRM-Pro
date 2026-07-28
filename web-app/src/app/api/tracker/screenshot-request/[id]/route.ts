// src/app/api/tracker/screenshot-request/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { uploadFile } from '@/lib/cloudinary'

// Admin: poll for the result of a request they made.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const { id } = await params

  const request = await prisma.screenshotRequest.findUnique({ where: { id } })
  if (!request) return errorResponse('Not found', 404)

  return successResponse({
    id: request.id,
    status: request.status,
    imageUrl: request.imageUrl,
    requestedAt: request.requestedAt,
    fulfilledAt: request.fulfilledAt,
  })
}

// Desktop app: fulfill the request with a single captured screenshot.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session
  const { id } = await params

  const employee = await prisma.employee.findUnique({ where: { userId: session.userId } })
  if (!employee) return errorResponse('No employee record for this account', 404)

  const request = await prisma.screenshotRequest.findUnique({ where: { id } })
  if (!request || request.employeeId !== employee.id) return errorResponse('Not found', 404)
  // Already fulfilled/expired by someone else (or the timeout) — nothing to do.
  if (request.status !== 'PENDING') return successResponse({ ok: true })

  const { image } = await req.json()
  if (!image) return errorResponse('image required')

  try {
    const uploaded = await uploadFile(image, 'screenshots')
    await prisma.screenshotRequest.update({
      where: { id },
      data: { status: 'FULFILLED', imageUrl: uploaded.url, imagePublicId: uploaded.publicId, fulfilledAt: new Date() },
    })
  } catch (e) {
    console.error('Screenshot upload failed:', e)
    await prisma.screenshotRequest.update({ where: { id }, data: { status: 'FAILED' } })
    return errorResponse('Upload failed')
  }

  return successResponse({ ok: true })
}
