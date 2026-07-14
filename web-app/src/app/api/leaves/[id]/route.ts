// src/app/api/leaves/[id]/route.ts
// Approve/reject leave. On approval, mark attendance as LEAVE (skip for SHORT_HOURLY).
// Fires hbs_leave_approved / hbs_leave_rejected WhatsApp to employee.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { sendMail, wrapEmailHtml } from '@/lib/mailer'
import { Notifications } from '@/lib/notify'
import { dateOnly } from '@/lib/attendanceDate'
import { getTeamScope } from '@/lib/teamScope'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    const { action, rejectionReason } = await req.json()
    if (!['approve', 'reject'].includes(action)) return errorResponse('Invalid action')

    const leave = await prisma.leave.findUnique({
      where: { id },
      include: {
        employee: { include: { user: { select: { name: true, phone: true, email: true } } } },
      },
    })
    if (!leave) return notFoundResponse('Leave')

    // Managers (team leads) can only approve/reject leaves of their own team
    // (dept they head + direct reports). Admins can act on anyone.
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) {
      const scope = await getTeamScope(session.userId)
      if (!scope.visibleIds.includes(leave.employeeId)) return errorResponse('Forbidden', 403)
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: newStatus,
        approvedBy: session.userId,
        approvedAt: new Date(),
        rejectionReason: action === 'reject' ? rejectionReason : null,
      },
    })

    // Fire WhatsApp notification to employee (best-effort)
    if (leave.employee?.user.phone) {
      const template = action === 'approve' ? 'hbs_leave_approved' : 'hbs_leave_rejected'
      const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN')
      const dateRange = leave.duration === 'SINGLE_DAY'
        ? fmt(leave.startDate)
        : `${fmt(leave.startDate)} to ${fmt(leave.endDate)}`

      sendWhatsapp({
        toPhone: leave.employee.user.phone,
        template,
        params: {
          employeeName: leave.employee.user.name,
          leaveType: leave.leaveType,
          dateRange,
          days: String(leave.days),
          rejectionReason: rejectionReason || '',
        },
        referenceType: 'LEAVE',
        referenceId: id,
      }).catch(() => {})

      // In-app notification
      const nDateRange = leave.duration === 'SINGLE_DAY'
        ? fmt(leave.startDate)
        : `${fmt(leave.startDate)} to ${fmt(leave.endDate)}`
      if (action === 'approve') Notifications.leaveApproved(leave.employee.userId, nDateRange).catch(() => {})
      else Notifications.leaveRejected(leave.employee.userId, nDateRange, rejectionReason).catch(() => {})
    }

    // Email employee about the approval/rejection (best-effort)
    if (leave.employee?.user.email) {
      const fmt = (d: Date) => new Date(d).toLocaleDateString('en-IN')
      const dateRange = leave.duration === 'SINGLE_DAY'
        ? fmt(leave.startDate)
        : `${fmt(leave.startDate)} to ${fmt(leave.endDate)}`
      const approved = action === 'approve'
      sendMail({
        to: leave.employee.user.email,
        subject: `Leave ${approved ? 'Approved' : 'Rejected'} - ${leave.leaveType}`,
        html: wrapEmailHtml(`Leave ${approved ? 'Approved' : 'Rejected'}`, `
          <p>Hi <b>${leave.employee.user.name}</b>,</p>
          <p>Your <b>${leave.leaveType}</b> leave request for <b>${dateRange}</b> has been
          <b style="color:${approved ? '#16a34a' : '#dc2626'}">${approved ? 'APPROVED' : 'REJECTED'}</b>.</p>
          ${!approved && rejectionReason ? `<p style="margin:4px 0;"><b>Reason:</b> ${rejectionReason}</p>` : ''}
        `),
        referenceType: 'LEAVE',
        referenceId: id,
      }).catch(() => {})
    }

    // Mark attendance as LEAVE for full-day leaves only (not SHORT_HOURLY)
    if (newStatus === 'APPROVED' && leave.duration !== 'SHORT_HOURLY') {
      const days: Date[] = []
      const current = dateOnly(leave.startDate)
      const endDay = dateOnly(leave.endDate)
      while (current <= endDay) {
        days.push(new Date(current))
        current.setUTCDate(current.getUTCDate() + 1)
      }
      await Promise.all(days.map(date =>
        prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: leave.employeeId, date } },
          update: { status: 'LEAVE' },
          create: { employeeId: leave.employeeId, date, status: 'LEAVE' },
        })
      ))
    }

    await logFromRequest(req, {
      userId: session.userId,
      action: newStatus,
      entityType: 'Leave',
      entityId: id,
      metadata: { rejectionReason, employeeId: leave.employeeId },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('Leave patch error:', error)
    return errorResponse('Failed to update leave', 500)
  }
}