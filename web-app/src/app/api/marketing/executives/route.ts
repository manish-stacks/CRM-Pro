// src/app/api/marketing/executives/route.ts
// Return list of MARKETING_EXECUTIVE (and above) users — for meeting-assign dropdown
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const executives = await prisma.user.findMany({
    where: {
      role: { in: ['MARKETING_EXECUTIVE', 'ADMIN', 'SUPER_ADMIN'] },
      isActive: true,
    },
    select: {
      id: true, name: true, email: true, phone: true, role: true, avatar: true,
      _count: {
        select: {
          meetingLeads: { where: { status: 'MEETING_SCHEDULED' } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return successResponse(executives, executives.length)
}
