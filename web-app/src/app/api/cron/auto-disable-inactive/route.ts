// src/app/api/cron/auto-disable-inactive/route.ts
// Cron endpoint — call once per day (same pattern as the other /api/cron/* jobs).
// Auto-disables an employee's login if they haven't logged in for 10+ days.
//
// Rules:
//  - Only applies to users that have an Employee record (not CLIENT accounts).
//  - SUPER_ADMIN and ADMIN are never auto-disabled — a safety guard so nobody
//    can accidentally lock every admin out at once.
//  - "10 days inactive" = lastLoginAt older than 10 days, OR the account has
//    never logged in (lastLoginAt is null) and it's been 10+ days since it
//    was created.
//  - Already-disabled users are skipped.
//  - Admins get an in-app + push notification listing who was disabled, so a
//    manager can re-enable someone manually if it was a mistake (e.g. approved
//    long leave).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/audit'
import { notify } from '@/lib/notify'

const INACTIVE_DAYS = 10

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS)

  // Candidates: active employee accounts, never disabled, not admins.
  const candidates = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { notIn: ['SUPER_ADMIN', 'ADMIN', 'CLIENT'] },
      employee: { isNot: null },
      OR: [
        { lastLoginAt: { lt: cutoff } },
        { lastLoginAt: null, createdAt: { lt: cutoff } },
      ],
    },
    select: { id: true, name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
  })

  const disabled: { id: string; name: string; email: string; lastLoginAt: Date | null }[] = []

  for (const u of candidates) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        isActive: false,
        disabledAt: new Date(),
        disabledReason: `Auto-disabled: no login for ${INACTIVE_DAYS}+ days`,
      },
    })

    await logActivity({
      userId: null, // system action
      action: 'AUTO_DISABLE',
      entityType: 'User',
      entityId: u.id,
      metadata: { reason: 'inactivity', lastLoginAt: u.lastLoginAt, days: INACTIVE_DAYS },
    })

    disabled.push({ id: u.id, name: u.name, email: u.email, lastLoginAt: u.lastLoginAt })
  }

  // Let admins/managers know so they can re-enable anyone disabled by mistake
  // (e.g. someone on approved long leave).
  if (disabled.length > 0) {
    const admins = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
      select: { id: true },
    })
    if (admins.length) {
      const names = disabled.map(d => d.name).join(', ')
      await notify({
        userIds: admins.map(a => a.id),
        title: `${disabled.length} login${disabled.length > 1 ? 's' : ''} auto-disabled`,
        message: `No login for ${INACTIVE_DAYS}+ days: ${names}`,
        type: 'warning',
        link: '/employees',
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true, disabledCount: disabled.length, disabled })
}