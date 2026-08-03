// src/app/api/cron/reminders/route.ts
// Cron — call every few minutes (e.g. */5 * * * *).
// Finds personal reminders whose time has arrived and pushes an in-app +
// mobile push notification (same notify()/Expo→FCM pipeline as everywhere
// else in the app), then stamps notifiedAt so it's never sent twice.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const due = await prisma.reminder.findMany({
    where: { isDone: false, notifiedAt: null, remindAt: { lte: new Date() } },
  })

  let notified = 0
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
    notified++
  }

  return NextResponse.json({ checked: due.length, notified })
}
