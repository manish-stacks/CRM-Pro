// src/app/api/clients/[id]/portal-access/route.ts
// Manage client portal access:
//   POST { action: 'activate' | 'regenerate' | 'disable' }
// 'activate' — first-time enable + send welcome email + WhatsApp
// 'regenerate' — reset password + resend welcome
// 'disable' — clear portalPasswordSet so client can't log in
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { activateClientPortal } from '@/lib/welcomeFlow'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireAuth(req, 'MANAGER')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const { action } = await req.json()
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, email: true, phone: true, portalPasswordSet: true, clientName: true },
  })
  if (!client) return notFoundResponse('Client')

  if (action === 'activate' || action === 'regenerate') {
    try {
      const result = await activateClientPortal(id, { regenerate: action === 'regenerate' })
      await logFromRequest(req, {
        userId: session.userId,
        action: action === 'activate' ? 'ACTIVATE_PORTAL' : 'REGENERATE_PORTAL',
        entityType: 'Client',
        entityId: id,
      })
      return successResponse({
        password: result.password,  // NOTE: shown ONCE to the admin who triggered
        emailSent: result.emailSent,
        whatsappSent: result.whatsappSent,
      })
    } catch (e: any) {
      return errorResponse(e.message || 'Failed to activate portal', 500)
    }
  }

  if (action === 'disable') {
    await prisma.client.update({
      where: { id },
      data: { portalPasswordSet: false, portalPassword: null },
    })
    await logFromRequest(req, {
      userId: session.userId,
      action: 'DISABLE_PORTAL',
      entityType: 'Client',
      entityId: id,
    })
    return successResponse({ ok: true })
  }

  return errorResponse('Invalid action. Use: activate | regenerate | disable')
}
