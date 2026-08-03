// src/app/api/cron/audit-log-cleanup/route.ts
// Cron endpoint — runs automatically once a day via instrumentation.ts
// (node-cron), and can also be hit manually / by an external scheduler
// (e.g. cron-job.org, Vercel Cron) using the same secret pattern as the
// other /api/cron/* routes.
// Deletes ActivityLog (shown in UI as "Audit Log") rows older than
// RETENTION_DAYS, so the table doesn't grow forever.
// Protected by CRON_SECRET env var — pass ?secret=... or X-Cron-Secret header.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const RETENTION_DAYS = 7

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const { count: deleted } = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return NextResponse.json({ success: true, deletedAuditLogs: deleted })
}