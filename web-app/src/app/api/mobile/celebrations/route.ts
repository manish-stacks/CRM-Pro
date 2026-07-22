// src/app/api/mobile/celebrations/route.ts
// Mobile-app version of /api/dashboard/celebrations.
// Identical logic, just placed under /api/mobile/* because middleware.ts only
// accepts the app's `Authorization: Bearer <token>` header for paths under
// /api/mobile/ — every other path requires the web `auth-token` cookie, which
// the mobile app doesn't have. Calling the non-mobile route from the app
// returned 401 Unauthorized even with a valid token; this route fixes that.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'
import { getISTDateParts } from '@/lib/attendanceDate'

// SQL month/day match for both birthdays and joining anniversaries
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  // Resolve "now" as today's IST calendar date, held as a UTC-midnight
  // instant, so every getUTC* call below is timezone-independent (the
  // server's own OS/process timezone is irrelevant).
  const { year: istY, month: istM, day: istD } = getISTDateParts(new Date())
  const now = new Date(Date.UTC(istY, istM, istD))

  // Fetch all active employees with dob + joiningDate
  const employees = await prisma.employee.findMany({
    where: { user: { isActive: true } },
    select: {
      id: true,
      employeeId: true,
      dateOfBirth: true,
      joiningDate: true,
      user: { select: { id: true, name: true, avatar: true, dateOfBirth: true } },
      department: { select: { name: true, color: true } },
    },
  })

  const isSameDay = (a: Date, b: Date) =>
    a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

  const daysUntil = (target: Date, from: Date) => {
    const t = new Date(Date.UTC(from.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))
    if (t < from) t.setUTCFullYear(from.getUTCFullYear() + 1)
    return Math.round((t.getTime() - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) / 86400000)
  }

  const todayBirthdays: any[] = []
  const todayAnniversaries: any[] = []
  const upcomingBirthdays: any[] = []
  const upcomingAnniversaries: any[] = []

  for (const emp of employees) {
    const dob = emp.dateOfBirth || emp.user.dateOfBirth
    const join = emp.joiningDate

    if (dob) {
      const d = new Date(dob)
      const du = daysUntil(d, now)
      if (isSameDay(d, now)) {
        todayBirthdays.push({
          userId: emp.user.id,
          id: emp.id, name: emp.user.name, avatar: emp.user.avatar,
          department: emp.department?.name, employeeId: emp.employeeId,
        })
      } else if (du > 0 && du <= 7) {
        upcomingBirthdays.push({
          id: emp.id, name: emp.user.name, avatar: emp.user.avatar,
          department: emp.department?.name, daysUntil: du,
          date: `${now.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
        })
      }
    }

    if (join) {
      const j = new Date(join)
      const du = daysUntil(j, now)
      const years = now.getUTCFullYear() - j.getUTCFullYear() - (
        now.getUTCMonth() < j.getUTCMonth() || (now.getUTCMonth() === j.getUTCMonth() && now.getUTCDate() < j.getUTCDate()) ? 1 : 0
      )
      if (isSameDay(j, now) && years >= 0) {
        todayAnniversaries.push({
          userId: emp.user.id,
          id: emp.id, name: emp.user.name, avatar: emp.user.avatar,
          department: emp.department?.name, years, employeeId: emp.employeeId,
        })
      } else if (years >= 1 && du > 0 && du <= 7) {
        upcomingAnniversaries.push({
          id: emp.id, name: emp.user.name, avatar: emp.user.avatar,
          department: emp.department?.name, years: years + 1, daysUntil: du,
          date: `${now.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`,
        })
      }
    }
  }

  upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil)
  upcomingAnniversaries.sort((a, b) => a.daysUntil - b.daysUntil)

  return successResponse({
    today: { birthdays: todayBirthdays, anniversaries: todayAnniversaries },
    upcoming: { birthdays: upcomingBirthdays.slice(0, 5), anniversaries: upcomingAnniversaries.slice(0, 5) },
  })
}