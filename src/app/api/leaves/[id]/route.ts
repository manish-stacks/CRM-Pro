// src/app/api/leaves/[id]/route.ts
// Approve/reject leave. On approval, mark attendance as LEAVE (skip for SHORT_HOURLY).
// Fires hbs_leave_approved / hbs_leave_rejected WhatsApp to employee.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'
import { dateOnly } from '@/lib/attendanceDate'

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
        employee: { include: { user: { select: { name: true, phone: true } } } },
      },
    })
    if (!leave) return notFoundResponse('Leave')

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
