// src/app/api/tracker/screenshot-request/history/route.ts
// Admin: browse recent screenshots taken so far (they get auto-deleted by
// the cleanup cron after RETENTION_DAYS — see /api/cron/screenshot-cleanup —
// so this is a "recent" view, not a permanent archive).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'
import { deleteFile } from '@/lib/cloudinary'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

  const items = await prisma.screenshotRequest.findMany({
    where: { status: 'FULFILLED', ...(employeeId ? { employeeId } : {}) },
    orderBy: { fulfilledAt: 'desc' },
    take: limit,
    select: {
      id: true, employeeId: true, imageUrl: true, requestedAt: true, fulfilledAt: true,
      employee: { select: { user: { select: { name: true } } } },
    },
  })

  return successResponse(items)
}

// Admin: delete a single screenshot (image + DB row) before the retention
// cron would normally get to it.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const row = await prisma.screenshotRequest.findUnique({ where: { id }, select: { imagePublicId: true } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (row.imagePublicId) await deleteFile(row.imagePublicId)
  await prisma.screenshotRequest.delete({ where: { id } })

  return successResponse({ deleted: true })
}
