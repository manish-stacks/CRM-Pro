// src/app/api/cron/audit-log-cleanup/route.ts
// Cron endpoint — runs automatically once a day via instrumentation.ts
// (node-cron), and can also be hit manually / by an external scheduler
// (e.g. cron-job.org, Vercel Cron) using the same secret pattern as the
// other /api/cron/* routes.
//
// 1-WEEK RETENTION. Anything older than RETENTION_DAYS is deleted:
//   - ActivityLog   (shown in the UI as "Audit Log")
//   - LoginActivity (Login history on the profile / employee pages)
//   - Notification  (only ones already READ — unread ones are kept)
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

  const [audit, logins, notifs] = await Promise.all([
    prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.loginActivity.deleteMany({ where: { loginAt: { lt: cutoff } } }),
    prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff }, isRead: true } }),
  ])

  return NextResponse.json({
    success: true,
    retentionDays: RETENTION_DAYS,
    cutoff,
    deletedAuditLogs: audit.count,
    deletedLoginActivities: logins.count,
    deletedReadNotifications: notifs.count,
  })
}
