// src/app/api/marketing/areas/route.ts
// Returns each marketing territory (Employee.area) with the executives
// covering it — used to populate the telecaller's Area picker when booking
// a meeting, and by /api/marketing/slots to know who to check availability for.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const employees = await prisma.employee.findMany({
    where: {
      area: { not: null },
      user: { role: 'MARKETING_EXECUTIVE', isActive: true },
    },
    select: {
      area: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { area: 'asc' },
  })

  const grouped: Record<string, { id: string; name: string; avatar: string | null }[]> = {}
  for (const e of employees) {
    if (!e.area) continue
    if (!grouped[e.area]) grouped[e.area] = []
    grouped[e.area].push({ id: e.user.id, name: e.user.name, avatar: e.user.avatar })
  }

  const areas = Object.entries(grouped).map(([area, executives]) => ({ area, executives }))
  return successResponse(areas, areas.length)
}
