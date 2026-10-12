// Logged-in user's own visiting card (mobile app). Uses the session, so it never
// depends on the public card route or the employee code format.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { buildCardData, CARD_EMPLOYEE_SELECT } from '@/lib/cardData'

export async function GET(req: NextRequest) {
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { employee } = res as any
  if (!employee) return fail('No employee record found for your account', 404)
  try {
    const full = await prisma.employee.findUnique({ where: { id: employee.id }, select: CARD_EMPLOYEE_SELECT })
    if (!full) return fail('No employee record found for your account', 404)
    return ok(await buildCardData(full))
  } catch (e) {
    console.error('Mobile visiting card error:', e)
    return fail('Failed to load visiting card', 500)
  }
}
