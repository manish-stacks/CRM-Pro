// src/app/api/chat/groups/[id]/typing/route.ts
// Lightweight "I'm typing" ping. Client calls this every ~3s while the
// user has text in the compose box; other members see it via the
// typingUsers field returned by GET /messages (anything pinged within the
// last 6s counts as "still typing").
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const membership = await prisma.chatMember.findFirst({
    where: { chatGroupId: id, userId: session.userId, isActive: true },
  })
  if (!membership) return errorResponse('Not a member of this chat', 403)

  const { stopped } = await req.json().catch(() => ({ stopped: false }))
  await prisma.chatMember.update({
    where: { id: membership.id },
    data: { typingAt: stopped ? null : new Date() },
  })

  return successResponse({ ok: true })
}
