// src/app/api/receipts/view/[token]/route.ts
// Public "view payment receipt" endpoint — mirrors /api/invoices/view/[token]
// and /api/proposals/view/[token]. No session required; the unguessable
// receiptToken IS the access control.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const payment = await prisma.payment.findFirst({
      where: { receiptToken: token },
      include: {
        invoice: {
          select: {
            invoiceNumber: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true,
            client: {
              select: {
                clientName: true, companyName: true, phone: true, email: true,
                address: true, city: true, gstNo: true,
              },
            },
          },
        },
      },
    })
    if (!payment) return errorResponse('Receipt not found', 404)

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['company_name', 'company_email', 'company_phone', 'company_address', 'company_gst'] } },
    })
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

    return successResponse({
      ...payment,
      company: {
        name:    settingsMap.company_name    || 'Your Company',
        email:   settingsMap.company_email   || '',
        phone:   settingsMap.company_phone   || '',
        address: settingsMap.company_address || '',
        gst:     settingsMap.company_gst     || '',
      },
    })
  } catch (error) {
    console.error('Receipt view error:', error)
    return errorResponse('Failed to load receipt')
  }
}