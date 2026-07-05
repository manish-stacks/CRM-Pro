import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const { status, dueDate, notes } = await req.json()
  const inv = await prisma.invoice.update({ where: { id: id }, data: { status: status || undefined, dueDate: dueDate ? new Date(dueDate) : undefined, notes: notes || undefined } })
  return successResponse(inv)
}
