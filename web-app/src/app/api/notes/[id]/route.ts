// src/app/api/notes/[id]/route.ts
// Update (edit / pin / recolor) or delete a single sticky note. Scoped to
// the owner — you can't touch someone else's note.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { successResponse, unauthorizedResponse, notFoundResponse, errorResponse } from '@/lib/api'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const existing = await prisma.note.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.userId) return notFoundResponse('Note')

  const body = await req.json()
  const data: any = {}
  if (body.title !== undefined) {
    if (!body.title.trim()) return errorResponse('Title required')
    data.title = body.title.trim()
  }
  if (body.content !== undefined) data.content = body.content
  if (body.color !== undefined) data.color = body.color
  if (body.pinned !== undefined) data.pinned = !!body.pinned

  const updated = await prisma.note.update({ where: { id }, data })
  return successResponse(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const existing = await prisma.note.findUnique({ where: { id } })
  if (!existing || existing.userId !== session.userId) return notFoundResponse('Note')

  await prisma.note.delete({ where: { id } })
  return successResponse({ ok: true })
}
