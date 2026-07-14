// src/app/api/cron/expiry-reminders/route.ts
// Cron endpoint — call once per day.
// Fires hbs_service_expiry_reminder WhatsApp to clients at 30/15/7/1 days before service expiry.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/whatsapp'

const REMINDER_DAYS = [30, 15, 7, 1]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let fired = 0
  const details: any[] = []

  for (const daysAhead of REMINDER_DAYS) {
    const target = new Date(now)
    target.setDate(target.getDate() + daysAhead)
    const nextDay = new Date(target)
    nextDay.setDate(nextDay.getDate() + 1)

    const services = await prisma.clientService.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { gte: target, lt: nextDay },
      },
      include: {
        client: { select: { clientName: true, phone: true, email: true } },
      },
    })

    for (const svc of services) {
      if (!svc.client.phone) continue
      sendWhatsapp({
        toPhone: svc.client.phone,
        template: 'hbs_service_expiry_reminder',
        params: {
          clientName: svc.client.clientName,
          serviceName: svc.serviceName,
          daysLeft: String(daysAhead),
          expiryDate: svc.expiryDate?.toLocaleDateString('en-IN') || '',
        },
        referenceType: 'SERVICE',
        referenceId: svc.id,
      }).catch(() => {})
      fired++
      details.push({ svcId: svc.id, client: svc.client.clientName, daysAhead })
    }
  }

  return NextResponse.json({ ok: true, fired, details })
}
