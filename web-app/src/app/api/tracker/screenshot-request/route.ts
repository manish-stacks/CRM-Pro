// src/app/api/tracker/screenshot-request/route.ts
// On-demand "show me this employee's screen right now" — admin creates a
// PENDING request; the desktop app polls (GET, as itself) and, if there's
// one waiting, captures a single screenshot and uploads it via PATCH on
// /[id]. No continuous recording — one screenshot per request.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

// If the desktop app doesn't answer within this window (offline, app closed,
// no active tracking session, etc.) the request is auto-expired so it can't
// come back and get fulfilled long after the admin gave up waiting.
const PENDING_TIMEOUT_MS = 30_000

// Admin: request a screenshot from an employee currently being tracked.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { employeeId } = await req.json()
  if (!employeeId) return errorResponse('employeeId required')

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return errorResponse('Employee not found', 404)

  // No hard pre-check on punch/tracking status here — the desktop app polls
  // for a pending request as soon as it's logged in, whether or not the
  // employee is punched in. If the app isn't open/reachable, the request
  // just times out (see GET below) instead of being rejected up front.

  // Superseded any earlier unanswered request for the same employee.
  await prisma.screenshotRequest.updateMany({
    where: { employeeId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  })

  const request = await prisma.screenshotRequest.create({
    data: { employeeId, requestedById: session.userId, status: 'PENDING' },
  })

  return successResponse({ id: request.id, status: request.status })
}

// Desktop app: "is there a pending screenshot request for me?" — polled
// every few seconds while the app is open and logged in.
export async function GET(req: NextRequest) {  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const employee = await prisma.employee.findUnique({ where: { userId: session.userId } })
  if (!employee) return successResponse(null)

  await prisma.screenshotRequest.updateMany({
    where: {
      employeeId: employee.id,
      status: 'PENDING',
      requestedAt: { lt: new Date(Date.now() - PENDING_TIMEOUT_MS) },
    },
    data: { status: 'EXPIRED' },
  })

  const pending = await prisma.screenshotRequest.findFirst({
    where: { employeeId: employee.id, status: 'PENDING' },
    orderBy: { requestedAt: 'asc' },
  })

  return successResponse(pending ? { id: pending.id } : null)
}
