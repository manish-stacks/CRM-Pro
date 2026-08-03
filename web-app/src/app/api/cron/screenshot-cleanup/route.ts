// src/app/api/cron/screenshot-cleanup/route.ts
// Cron endpoint — call once a day (e.g. cron-job.org / Vercel Cron).
// Deletes any FULFILLED screenshot older than RETENTION_DAYS: removes the
// actual image from Cloudinary (that's the storage that fills up) and the
// DB row (so /history stops listing it). This keeps a rolling window of
// recent screenshots for admins to review, instead of keeping them forever.
// Also sweeps up EXPIRED/FAILED rows older than a day — they never had an
// image, just DB clutter.
// Protected by CRON_SECRET env var — pass ?secret=... or X-Cron-Secret header.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/cloudinary'

const RETENTION_DAYS = 7

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const old = await prisma.screenshotRequest.findMany({
    where: { status: 'FULFILLED', fulfilledAt: { lt: cutoff } },
    select: { id: true, imagePublicId: true },
  })

  let deleted = 0
  for (const row of old) {
    if (row.imagePublicId) await deleteFile(row.imagePublicId)
    await prisma.screenshotRequest.delete({ where: { id: row.id } })
    deleted++
  }

  // Housekeeping: drop stale never-fulfilled rows too (no image to delete).
  const { count: clutterRemoved } = await prisma.screenshotRequest.deleteMany({
    where: {
      status: { in: ['EXPIRED', 'FAILED'] },
      requestedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })

  return NextResponse.json({ success: true, deletedScreenshots: deleted, clutterRemoved })
}
