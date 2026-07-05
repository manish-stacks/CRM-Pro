// src/app/api/cron/celebrations/route.ts
// Cron endpoint — call once per day (e.g. cron-job.org / Vercel Cron).
// Fires:
//   - hbs_birthday_wish WhatsApp to employees whose DOB is today
//   - hbs_work_anniversary WhatsApp to employees whose joinDate anniversary is today
//   - In-app notification to all colleagues
// Protected by CRON_SECRET env var — pass ?secret=... or X-Cron-Secret header.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()

  // Fetch employees + linked users with DOB or joinDate today
  const allEmployees = await prisma.employee.findMany({
    where: {
      user: { isActive: true },
    },
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
  })

  // All active users (for colleague notifications)
  const allActiveUsers = await prisma.user.findMany({
    where: { isActive: true, role: { not: 'CLIENT' } },
    select: { id: true },
  })
  const allUserIds = allActiveUsers.map(u => u.id)

  const birthdaysToday: any[] = []
  const anniversariesToday: any[] = []

  for (const e of allEmployees) {
    if (e.dateOfBirth) {
      const d = new Date(e.dateOfBirth)
      if (d.getMonth() + 1 === month && d.getDate() === day) {
        birthdaysToday.push(e)
      }
    }
    if (e.joiningDate) {
      const d = new Date(e.joiningDate)
      if (d.getMonth() + 1 === month && d.getDate() === day && d.getFullYear() < today.getFullYear()) {
        anniversariesToday.push({ ...e, years: today.getFullYear() - d.getFullYear() })
      }
    }
  }

  // Fire birthday WhatsApp + colleague notifications
  for (const e of birthdaysToday) {
    if (e.user?.phone) {
      sendWhatsapp({
        toPhone: e.user.phone,
        template: 'hbs_birthday_wish',
        params: { employeeName: e.user.name },
        referenceType: 'BIRTHDAY',
        referenceId: e.id,
      }).catch(() => {})
    }
    // Notify colleagues (excluding self)
    const colleagues = allUserIds.filter(uid => uid !== e.user.id)
    if (colleagues.length) {
      Notifications.birthday(colleagues, e.user.name).catch(() => {})
    }
  }

  // Fire anniversary WhatsApp
  for (const e of anniversariesToday) {
    if (e.user?.phone) {
      sendWhatsapp({
        toPhone: e.user.phone,
        template: 'hbs_work_anniversary',
        params: {
          employeeName: e.user.name,
          years: String(e.years),
        },
        referenceType: 'ANNIVERSARY',
        referenceId: e.id,
      }).catch(() => {})
    }
  }

  return NextResponse.json({
    ok: true,
    date: `${day}/${month}`,
    birthdays: birthdaysToday.length,
    anniversaries: anniversariesToday.length,
  })
}
