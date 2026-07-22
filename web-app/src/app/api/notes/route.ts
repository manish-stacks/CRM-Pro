// src/app/api/notes/route.ts
// Free-form personal sticky notes — private per user, no date attached.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse, errorResponse } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const items = await prisma.note.findMany({
    where: { userId: session.userId },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  })

  return successResponse(items)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const { title, content, color } = await req.json()
  if (!title || !title.trim()) return errorResponse('Title required')

  const note = await prisma.note.create({
    data: {
      userId: session.userId,
      title: title.trim(),
      content: content || '',
      color: color || 'yellow',
    },
  })

  return successResponse(note)
}
