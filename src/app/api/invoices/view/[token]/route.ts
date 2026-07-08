// src/app/api/invoices/view/[token]/route.ts
// Public "view invoice" endpoint — mirrors /api/proposals/view/[token].
// No session required; the unguessable shareToken IS the access control,
// exactly like the existing proposal share links.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { shareToken: token },
      include: {
        client: {
          select: {
            clientCode: true, clientName: true, companyName: true,
            phone: true, email: true, address: true, city: true, state: true,
            gstNo: true, pincode: true,
          },
        },
        items: { orderBy: { order: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' }, select: { amount: true, method: true, paidAt: true, reference: true } },
      },
    })
    if (!invoice) return errorResponse('Invoice not found', 404)

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['company_name', 'company_email', 'company_phone', 'company_address', 'company_gst'] } },
    })
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

    return successResponse({
      ...invoice,
      company: {
        name:    settingsMap.company_name    || 'Your Company',
        email:   settingsMap.company_email   || '',
        phone:   settingsMap.company_phone   || '',
        address: settingsMap.company_address || '',
        gst:     settingsMap.company_gst     || '',
      },
    })
  } catch (error) {
    console.error('Invoice view error:', error)
    return errorResponse('Failed to load invoice')
  }
}