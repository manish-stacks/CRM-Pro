// src/app/api/cron/meeting-reminders/route.ts
// Cron endpoint — call once per day (morning).
// Fires WhatsApp reminders to clients for meetings scheduled today.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsapp } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)

  const meetings = await prisma.lead.findMany({
    where: {
      meetingDate: { gte: start, lt: end },
      status: { in: ['MEETING_SCHEDULED', 'CALLBACK'] },
    },
    select: {
      id: true, leadNumber: true, clientName: true, clientPhone: true,
      meetingDate: true, meetingSlot: true, meetingTime: true,
      meetingAssignedTo: { select: { name: true, phone: true } },
    },
  })

  let fired = 0
  for (const m of meetings) {
    if (!m.clientPhone) continue
    sendWhatsapp({
      toPhone: m.clientPhone,
      template: 'hbs_lead_meeting_scheduled',
      params: {
        clientName: m.clientName,
        meetingDate: m.meetingDate!.toLocaleDateString('en-IN'),
        meetingTime: m.meetingTime || m.meetingSlot || 'today',
        marketingPersonName: m.meetingAssignedTo?.name || '',
        marketingPhone: m.meetingAssignedTo?.phone || '',
      },
      referenceType: 'LEAD',
      referenceId: m.id,
    }).catch(() => {})
    fired++
  }

  return NextResponse.json({ ok: true, fired })
}
