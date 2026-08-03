// src/app/api/tracking/live/route.ts
// Admin/Manager: latest known location of all currently checked-in field staff.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth

  const today = todayDateOnly()

  // Active attendance sessions (checked in, not out) — MARKETING_EXECUTIVE only
  const active = await prisma.attendance.findMany({
    where: {
      date: today,
      punchIn: { not: null },
      punchOut: null,
      employee: { user: { role: 'MARKETING_EXECUTIVE' } },
    },
    include: {
      employee: {
        include: { user: { select: { id: true, name: true, avatar: true, phone: true, role: true } } },
      },
    },
  })

  // For each active user, get their latest ping
  const results = await Promise.all(active.map(async (att) => {
    const uid = att.employee.user.id
    const lastPing = await prisma.locationPing.findFirst({
      where: { userId: uid },
      orderBy: { recordedAt: 'desc' },
    })
    return {
      userId: uid,
      name: att.employee.user.name,
      avatar: att.employee.user.avatar,
      phone: att.employee.user.phone,
      role: att.employee.user.role,
      checkInAt: att.punchIn,
      lastPing: lastPing ? {
        latitude: lastPing.latitude,
        longitude: lastPing.longitude,
        accuracy: lastPing.accuracy,
        battery: lastPing.battery,
        isMoving: lastPing.isMoving,
        recordedAt: lastPing.recordedAt,
        address: lastPing.address,
      } : null,
    }
  }))

  return successResponse(results, results.length)
}