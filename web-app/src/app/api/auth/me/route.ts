// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      employee: { include: { department: true } }
    }
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { password: _, ...safeUser } = user
  return NextResponse.json(safeUser)
}
