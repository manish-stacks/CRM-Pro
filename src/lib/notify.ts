// src/lib/notify.ts
// Create in-app notifications for one or more users
import { prisma } from './prisma'
import { sendExpoPush } from './push'

type NotifyInput = {
  userIds: string | string[]
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'birthday' | 'anniversary' | 'lead' | 'meeting' | 'ticket' | 'payment' | 'report'
  link?: string
  metadata?: Record<string, any>
}

export async function notify(input: NotifyInput) {
  const raw = Array.isArray(input.userIds) ? input.userIds : [input.userIds]
  // Filter falsy + dedupe (a bad/undefined userId would make createMany throw and
  // silently drop the whole batch — this is why some events never notified).
  const users = Array.from(new Set(raw.filter((u): u is string => !!u)))
  if (!users.length) return

  try {
    await prisma.notification.createMany({
      data: users.map(userId => ({
        userId,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        link: input.link || null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })),
    })

    // Mobile push (best-effort) to any of these users with a registered device
    const withTokens = await prisma.user.findMany({
      where: { id: { in: users }, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    })
    if (withTokens.length) {
      sendExpoPush(
        withTokens.map(u => u.expoPushToken),
        { title: input.title, body: input.message, data: { link: input.link || '' } },
      ).catch(() => {})
    }
  } catch (e) {
    console.error('Notify failed:', e)
  }
}

// Convenience wrappers matching common events
export const Notifications = {
  meetingScheduled: (marketingExecId: string, clientName: string, date: string, leadId: string) =>
    notify({
      userIds: marketingExecId,
      title: '🎯 New Meeting Scheduled',
      message: `Meeting with ${clientName} on ${date}`,
      type: 'meeting',
      link: `/leads/${leadId}`,
    }),

  leadReassigned: (userId: string, leadNumber: string, leadId: string, reason?: string) =>
    notify({
      userIds: userId,
      title: '🔄 Lead Assigned to You',
      message: `${leadNumber}${reason ? ` — ${reason}` : ''}`,
      type: 'lead',
      link: `/leads/${leadId}`,
    }),

  ticketAssigned: (userId: string, ticketNumber: string, subject: string, ticketId: string) =>
    notify({
      userIds: userId,
      title: `🎫 Ticket ${ticketNumber} assigned to you`,
      message: subject,
      type: 'ticket',
      link: `/tickets/${ticketId}`,
    }),

  paymentReceived: (userIds: string[], invoiceNumber: string, amount: number, invoiceId: string) =>
    notify({
      userIds,
      title: `💰 Payment received on ${invoiceNumber}`,
      message: `₹${amount.toLocaleString('en-IN')}`,
      type: 'payment',
      link: `/invoices/${invoiceId}`,
    }),

  reportUploaded: (userIds: string | string[], clientName: string, title: string, clientId: string) =>
    notify({
      userIds,
      title: `📊 Report shared: ${clientName}`,
      message: title,
      type: 'report',
      link: `/clients/${clientId}`,
    }),

  // ---- Project assignments ----
  projectAssignedManager: (userId: string, serviceName: string, clientName: string, clientId: string) =>
    notify({
      userIds: userId,
      title: '🗂️ You are now Head of a project',
      message: `${serviceName} — ${clientName}`,
      type: 'info',
      link: `/clients/${clientId}`,
    }),

  projectAssignedMember: (userIds: string | string[], serviceName: string, clientName: string, clientId: string) =>
    notify({
      userIds,
      title: '👥 Added to a project team',
      message: `${serviceName} — ${clientName}`,
      type: 'info',
      link: `/clients/${clientId}`,
    }),

  // ---- Internal (employee) tickets ----
  employeeTicketRaised: (userIds: string | string[], ticketNumber: string, subject: string, ticketId: string) =>
    notify({
      userIds,
      title: `🎫 New internal ticket ${ticketNumber}`,
      message: subject,
      type: 'ticket',
      link: `/my-tickets/${ticketId}`,
    }),

  employeeTicketReply: (userIds: string | string[], ticketNumber: string, ticketId: string) =>
    notify({
      userIds,
      title: `💬 Reply on ${ticketNumber}`,
      message: 'New reply on your internal ticket',
      type: 'ticket',
      link: `/my-tickets/${ticketId}`,
    }),

  // ---- Support (client) tickets ----
  supportTicketReply: (userIds: string | string[], ticketNumber: string, ticketId: string) =>
    notify({
      userIds,
      title: `💬 Reply on ${ticketNumber}`,
      message: 'New reply on a support ticket',
      type: 'ticket',
      link: `/tickets/${ticketId}`,
    }),

  // ---- Leads ----
  leadAssigned: (userId: string, leadNumber: string, leadId: string) =>
    notify({
      userIds: userId,
      title: '📞 New Lead Assigned',
      message: leadNumber,
      type: 'lead',
      link: `/leads/${leadId}`,
    }),

  leaveApproved: (userId: string, dateRange: string) =>
    notify({
      userIds: userId,
      title: '✅ Leave Approved',
      message: dateRange,
      type: 'success',
      link: `/leaves`,
    }),

  leaveRejected: (userId: string, dateRange: string, reason?: string) =>
    notify({
      userIds: userId,
      title: '❌ Leave Rejected',
      message: `${dateRange}${reason ? ` — ${reason}` : ''}`,
      type: 'error',
      link: `/leaves`,
    }),

  birthday: (userIds: string[], employeeName: string) =>
    notify({
      userIds,
      title: '🎂 Birthday Today!',
      message: `Wish ${employeeName} a happy birthday`,
      type: 'birthday',
    }),
}
