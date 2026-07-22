// src/app/api/cron/payment-reminders/route.ts
// Cron — call once per day.
// 1) Reminds assigned staff (in-app) about invoices with a pending balance at 3/1/0 days
//    before the due date, and every day once overdue.
// 2) Marks past-due invoices as OVERDUE.
// 3) Best-effort WhatsApp nudge to the client (template optional).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { sendWhatsapp } from '@/lib/whatsapp'
import { todayDateOnly } from '@/lib/attendanceDate'

const AHEAD_DAYS = [3, 1, 0] // remind 3 days before, 1 day before, and on the due date

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') || req.headers.get('x-cron-secret')
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = todayDateOnly() // IST "today" as a UTC-midnight instant, matches @db.Date storage

  let notified = 0
  let markedOverdue = 0
  const details: any[] = []

  // Helper: notify assigned staff + optional WhatsApp for a set of invoices
  const remind = async (invoices: any[], phase: string) => {
    for (const inv of invoices) {
      const staff = Array.from(new Set([
        inv.client?.telecallerId,
        inv.client?.marketingPersonId,
        inv.client?.reportingPersonId,
      ].filter(Boolean))) as string[]

      if (staff.length) {
        await notify({
          userIds: staff,
          title: phase === 'overdue'
            ? `⚠️ Payment overdue — ${inv.invoiceNumber}`
            : `⏰ Payment due ${phase} — ${inv.invoiceNumber}`,
          message: `${inv.client?.clientName || 'Client'} · Balance ${inr(inv.dueAmount)} of ${inr(inv.totalAmount)}`,
          type: 'payment',
          link: `/invoices/${inv.id}`,
        })
        notified += staff.length
      }

      // Best-effort WhatsApp to client (template must exist in your provider; ignored if it fails)
      if (inv.client?.phone) {
        sendWhatsapp({
          toPhone: inv.client.phone,
          template: 'hbs_payment_due_reminder',
          params: {
            clientName: inv.client.clientName,
            amount: inr(inv.dueAmount),
            invoiceNumber: inv.invoiceNumber,
            dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
          },
          referenceType: 'INVOICE',
          referenceId: inv.id,
        }).catch(() => {})
      }
      details.push({ invoice: inv.invoiceNumber, phase, due: inv.dueAmount })
    }
  }

  const includeClient = {
    client: {
      select: {
        clientName: true, phone: true,
        telecallerId: true, marketingPersonId: true, reportingPersonId: true,
      },
    },
  }

  // 1) Advance + due-day reminders (only invoices with a balance)
  for (const daysAhead of AHEAD_DAYS) {
    const target = new Date(now)
    target.setUTCDate(target.getUTCDate() + daysAhead)
    const nextDay = new Date(target)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)

    const invoices = await prisma.invoice.findMany({
      where: {
        dueAmount: { gt: 0 },
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { gte: target, lt: nextDay },
      },
      include: includeClient,
    })
    await remind(invoices, daysAhead === 0 ? 'today' : `in ${daysAhead}d`)
  }

  // 2) Mark past-due invoices as OVERDUE
  const overdueUpdate = await prisma.invoice.updateMany({
    where: {
      dueAmount: { gt: 0 },
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  })
  markedOverdue = overdueUpdate.count

  // 3) Daily nudge for anything overdue with a balance
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      dueAmount: { gt: 0 },
      status: 'OVERDUE',
      dueDate: { lt: now },
    },
    include: includeClient,
  })
  await remind(overdueInvoices, 'overdue')

  return NextResponse.json({
    ok: true,
    notified,
    markedOverdue,
    overdueCount: overdueInvoices.length,
    details,
  })
}