// Public digital visiting card data (shared by marketing executives with clients).
// No session required; only business-safe fields are returned.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { buildCardData, CARD_EMPLOYEE_SELECT } from '@/lib/cardData'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params
  try {
    const employee = await prisma.employee.findUnique({ where: { employeeId }, select: CARD_EMPLOYEE_SELECT })
    if (!employee || !employee.user.isActive || employee.user.role !== 'MARKETING_EXECUTIVE') {
      return errorResponse('Visiting card not found', 404)
    }
    return successResponse(await buildCardData(employee))
  } catch (e) {
    console.error('Visiting card error:', e)
    return errorResponse('Failed to load visiting card')
  }
}
