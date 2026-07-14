import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { todayDateOnly } from '@/lib/attendanceDate'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  try {
    const employee = await prisma.employee.findFirst({ where: { userId: session.userId } })
    if (!employee) return successResponse(null)

    const today = todayDateOnly()

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: today },
    })
    return successResponse(attendance)
  } catch {
    return errorResponse('Failed')
  }
}