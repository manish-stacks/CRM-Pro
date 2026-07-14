// src/app/api/dashboard/celebrations/route.ts
// Returns today's birthdays + work anniversaries + upcoming (next 7 days)
// Everyone can see these; sidebar/dashboard widgets use this endpoint.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'

// SQL month/day match for both birthdays and joining anniversaries
// MySQL syntax used (matches Prisma provider = mysql)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const now = new Date()

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
    a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const daysUntil = (target: Date, from: Date) => {
    const t = new Date(from.getFullYear(), target.getMonth(), target.getDate())
    if (t < from) t.setFullYear(from.getFullYear() + 1)
    return Math.round((t.getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000)
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
          date: `${now.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        })
      }
    }

    if (join) {
      const j = new Date(join)
      const du = daysUntil(j, now)
      const years = now.getFullYear() - j.getFullYear() - (
        now.getMonth() < j.getMonth() || (now.getMonth() === j.getMonth() && now.getDate() < j.getDate()) ? 1 : 0
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
          date: `${now.getFullYear()}-${String(j.getMonth() + 1).padStart(2, '0')}-${String(j.getDate()).padStart(2, '0')}`,
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