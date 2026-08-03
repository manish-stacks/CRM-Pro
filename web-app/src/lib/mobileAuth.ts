// src/lib/mobileAuth.ts
// Helper for mobile API routes — resolves Bearer token → session + employee.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'

export async function getMobileSession(req: NextRequest) {
  const session = await getRequestSession(req) // already supports Bearer header
  return session
}

/** Returns { session, employee } or a 401/404 NextResponse */
export async function requireMobileEmployee(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  const employee = await prisma.employee.findFirst({
    where: { userId: session.userId },
    include: { department: true },
  })
  return { session, employee }
}

export function ok(data: any, extra: Record<string, any> = {}) {
  return NextResponse.json({ success: true, data, ...extra })
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status })
}
