// src/app/api/mobile/notifications/route.ts
// Notifications feed for the mobile app.
//  - Staff (Bearer user token): their Notification records.
//  - Client (Bearer client token): an activity feed built from recent reports,
//    invoices, and ticket updates (clients have no Notification rows).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest) {
  // ---- Staff ----
  const staff = await getRequestSession(req)
  if (staff) {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: staff.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: staff.userId, isRead: false } }),
    ])
    return NextResponse.json({ success: true, data: { items, unreadCount } })
  }

  // ---- Client (activity feed) ----
  const client = await getClientSession(req)
  if (client) {
    const [reports, invoices, tickets] = await Promise.all([
      prisma.clientReport.findMany({
        where: { clientId: client.clientId },
        orderBy: { createdAt: 'desc' }, take: 15,
        select: { id: true, title: true, createdAt: true },
      }),
      prisma.invoice.findMany({
        where: { clientId: client.clientId },
        orderBy: { createdAt: 'desc' }, take: 15,
        select: { id: true, invoiceNumber: true, status: true, dueAmount: true, createdAt: true },
      }),
      prisma.supportTicket.findMany({
        where: { clientId: client.clientId },
        orderBy: { updatedAt: 'desc' }, take: 15,
        select: { id: true, ticketNumber: true, status: true, subject: true, updatedAt: true },
      }),
    ])

    const feed = [
      ...reports.map(r => ({
        id: `report-${r.id}`, type: 'report', title: 'New report shared',
        message: r.title, createdAt: r.createdAt,
      })),
      ...invoices.map(i => ({
        id: `invoice-${i.id}`, type: 'invoice',
        title: i.dueAmount > 0 ? `Invoice ${i.invoiceNumber} — ${i.status}` : `Invoice ${i.invoiceNumber} paid`,
        message: i.dueAmount > 0 ? `Balance due ₹${Number(i.dueAmount).toLocaleString('en-IN')}` : 'Thank you for your payment',
        createdAt: i.createdAt,
      })),
      ...tickets.map(t => ({
        id: `ticket-${t.id}`, type: 'ticket', title: `Ticket ${t.ticketNumber} — ${t.status}`,
        message: t.subject, createdAt: t.updatedAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ success: true, data: { items: feed, unreadCount: 0 } })
  }

  return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
}
