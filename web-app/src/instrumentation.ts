// src/instrumentation.ts
// FIX: Reminders were created fine and /api/cron/reminders correctly finds
// due ones and calls notify() on them — but nothing was ever calling that
// endpoint. `node-cron` was already sitting in package.json but never
// imported anywhere, and there's no vercel.json / external scheduler either,
// so due reminders just sat there forever with notifiedAt still null and no
// notification ever went out. This runs once when the Node server boots
// (`next start`) and actually schedules the check.
//
// Next.js calls this automatically on server start — no extra config needed
// (the `register` export name and file location are a Next.js convention).
export async function register() {
  // This file also loads in the Edge runtime (middleware) — node-cron only
  // works in a real Node process, so bail out there.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Next dev mode can re-import this module on hot reloads; guard against
  // scheduling the same job twice in one process.
  const g = globalThis as unknown as { __hbsCronStarted?: boolean }
  if (g.__hbsCronStarted) return
  g.__hbsCronStarted = true

  const cron = (await import('node-cron')).default
  const { prisma } = await import('@/lib/prisma')
  const { notify } = await import('@/lib/notify')

  // Every minute — reminders are set to a specific minute, so anything
  // coarser makes them feel late.
  cron.schedule('* * * * *', async () => {
    try {
      const due = await prisma.reminder.findMany({
        where: { isDone: false, notifiedAt: null, remindAt: { lte: new Date() } },
      })
      for (const r of due) {
        await notify({
          userIds: r.userId,
          title: `⏰ Reminder: ${r.title}`,
          message: r.note || 'Tap to view your reminders',
          type: 'info',
          link: '/reminders',
          metadata: { screen: 'Reminders', reminderId: r.id },
        })
        await prisma.reminder.update({ where: { id: r.id }, data: { notifiedAt: new Date() } })
      }
    } catch (err) {
      console.error('[reminders-cron] failed:', err)
    }
  })

  console.log('[instrumentation] Reminders cron scheduled (every minute).')

  // Daily at 3:00 AM — purge ActivityLog (Audit Log) rows older than 7 days
  // so the table doesn't grow forever. Same retention window is enforced
  // again inside /api/cron/audit-log-cleanup in case an external scheduler
  // also hits it.
  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      // 1-week retention across every log table, not just ActivityLog.
      const [audit, logins, notifs] = await Promise.all([
        prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
        prisma.loginActivity.deleteMany({ where: { loginAt: { lt: cutoff } } }),
        // Unread notifications are kept — only already-read ones are purged.
        prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff }, isRead: true } }),
      ])
      console.log(
        `[log-cleanup] 7-day purge — audit:${audit.count} logins:${logins.count} readNotifications:${notifs.count}`
      )
    } catch (err) {
      console.error('[audit-log-cleanup-cron] failed:', err)
    }
  })

  console.log('[instrumentation] Audit log cleanup cron scheduled (daily 3 AM, 7-day retention).')
}