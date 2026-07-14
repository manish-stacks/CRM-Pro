// src/app/api/invoices/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { order: 'asc' } },
      client: true,
      payments: { orderBy: { paidAt: 'desc' } },
    },
  })
  if (!invoice) return notFoundResponse('Invoice')
  return successResponse(invoice)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const body = await req.json()

  const existing = await prisma.invoice.findUnique({ where: { id } })
  if (!existing) return notFoundResponse('Invoice')
  if (existing.status === 'PAID') return errorResponse('Cannot edit a paid invoice')

  const data: Record<string, any> = {}
  if (body.notes !== undefined) data.notes = body.notes
  if (body.terms !== undefined) data.terms = body.terms
  if (body.dueDate) data.dueDate = new Date(body.dueDate)
  if (body.status) data.status = body.status

  try {
    const updated = await prisma.invoice.update({ where: { id }, data })
    await logFromRequest(req, {
      userId: session.userId, action: 'UPDATE', entityType: 'Invoice', entityId: id, changes: data,
    })
    return successResponse(updated)
  } catch (e: any) {
    return errorResponse(e.message || 'Update failed')
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    await prisma.invoice.delete({ where: { id } })
    await logFromRequest(req, {
      userId: session.userId, action: 'DELETE', entityType: 'Invoice', entityId: id,
    })
    return successResponse({ deleted: true })
  } catch (e: any) {
    return errorResponse(e.message || 'Delete failed')
  }
}
