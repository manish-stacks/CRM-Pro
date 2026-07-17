// src/app/api/cron/tracker-cleanup/route.ts
// Cron endpoint — call once per day (same pattern as the other /api/cron/* jobs).
// Deletes tracker screenshots older than the admin-configured retention
// window (Settings > Tracker > "Auto-delete after N days"), both from
// Cloudinary and the DB row, to control storage cost and privacy exposure.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Settings } from '@/lib/settings'
import { deleteFile } from '@/lib/cloudinary'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const retentionDays = await Settings.trackerRetentionDays()
  
  if (retentionDays === undefined) {
    throw new Error('Tracker retention days is not configured.')
  }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const old = await prisma.trackerScreenshot.findMany({
    where: { capturedAt: { lt: cutoff } },
    select: { id: true, publicId: true },
  })

  let deleted = 0
  for (const shot of old) {
    if (shot.publicId) {
      await deleteFile(shot.publicId, 'image').catch(() => { })
    }
    deleted++
  }

  if (old.length) {
    await prisma.trackerScreenshot.deleteMany({ where: { id: { in: old.map(o => o.id) } } })
  }

  return NextResponse.json({ success: true, retentionDays, deletedCount: deleted })
}
