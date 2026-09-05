// src/app/api/employees/celebrations/route.ts
// Admin/Manager (TL) only: list every employee's birthday + work-anniversary
// falling in a given month, so they can review/download who to celebrate.
// GET /api/employees/celebrations?month=1-12  (defaults to current month)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()
  // Only Admin/Super Admin/Manager (TL) may view or export this list.
  if (!hasMinRole(session.role, 'MANAGER')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const month = Number(searchParams.get('month')) || (new Date().getMonth() + 1)

  const employees = await prisma.employee.findMany({
    where: { user: { isActive: true } },
    select: {
      id: true,
      employeeId: true,
      dateOfBirth: true,
      joiningDate: true,
      user: { select: { id: true, name: true, phone: true, email: true, dateOfBirth: true } },
      department: { select: { name: true } },
    },
  })

  const rows: any[] = []
  for (const emp of employees) {
    const dob = emp.dateOfBirth || emp.user.dateOfBirth
    if (dob) {
      const d = new Date(dob)
      if (d.getUTCMonth() + 1 === month) {
        rows.push({
          employeeId: emp.employeeId,
          name: emp.user.name,
          department: emp.department?.name || '-',
          phone: emp.user.phone || '-',
          email: emp.user.email || '-',
          type: 'Birthday',
          date: `${String(d.getUTCDate()).padStart(2, '0')}-${String(month).padStart(2, '0')}`,
          day: d.getUTCDate(),
        })
      }
    }
    if (emp.joiningDate) {
      const j = new Date(emp.joiningDate)
      if (j.getUTCMonth() + 1 === month) {
        const years = new Date().getUTCFullYear() - j.getUTCFullYear()
        rows.push({
          employeeId: emp.employeeId,
          name: emp.user.name,
          department: emp.department?.name || '-',
          phone: emp.user.phone || '-',
          email: emp.user.email || '-',
          type: years <= 0 ? 'Joining' : `Anniversary (${years}yr)`,
          date: `${String(j.getUTCDate()).padStart(2, '0')}-${String(month).padStart(2, '0')}`,
          day: j.getUTCDate(),
        })
      }
    }
  }

  rows.sort((a, b) => a.day - b.day)

  return successResponse({ month, rows })
}
