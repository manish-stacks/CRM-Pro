// src/app/api/id-verify/[employeeId]/route.ts
// Public "verify employee ID card" endpoint — scanned from the ID card QR code.
// No session required; only safe, non-sensitive fields are returned. This is
// what a security guard / client scanning the card should see to confirm the
// person is a genuine, currently-active HBS employee.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params

  try {
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        position: true,
        joiningDate: true,
        department: { select: { name: true } },
        user: { select: { name: true, avatar: true, phone: true, email: true, isActive: true } },
      },
    })
    if (!employee) return errorResponse('No employee found for this ID card', 404)

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['company_name', 'company_phone', 'company_email'] } },
    })
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

    return successResponse({
      employeeId: employee.employeeId,
      name: employee.user.name,
      avatar: employee.user.avatar,
      position: employee.position,
      department: employee.department?.name || null,
      joiningDate: employee.joiningDate,
      phone: employee.user.phone,
      email: employee.user.email,
      isActive: employee.user.isActive,
      company: {
        name: settingsMap.company_name || 'Hover Business Services LLP.',
        phone: settingsMap.company_phone || '',
        email: settingsMap.company_email || '',
      },
    })
  } catch (error) {
    console.error('ID verify error:', error)
    return errorResponse('Failed to verify ID card')
  }
}
