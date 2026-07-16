// src/app/api/tracker/checkout/route.ts
// Desktop app calls this on "Check Out". Closes the session.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const employee = await prisma.employee.findUnique({ where: { userId: session.userId } })
  if (!employee) return errorResponse('No employee record for this account', 404)

  const { sessionId, idleSeconds } = await req.json()
  if (!sessionId) return errorResponse('sessionId required')

  const trackerSession = await prisma.trackerSession.findUnique({ where: { id: sessionId } })
  if (!trackerSession || trackerSession.employeeId !== employee.id) {
    return errorResponse('Session not found', 404)
  }

  const updated = await prisma.trackerSession.update({
    where: { id: sessionId },
    data: {
      checkOutAt: new Date(),
      idleSeconds: typeof idleSeconds === 'number' ? idleSeconds : trackerSession.idleSeconds,
      status: 'CLOSED',
    },
  })

  return successResponse({ session: updated })
}
