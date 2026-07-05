// src/app/api/client-portal/invoices/[id]/route.ts
// Full invoice detail for a client (for PDF generation)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoice = await prisma.invoice.findFirst({
    where: { id, clientId: session.clientId },
    include: {
      items: true,
      client: {
        select: {
          clientCode: true, clientName: true, companyName: true,
          phone: true, email: true, address: true, city: true,
          state: true, gstNo: true, pincode: true,
        },
      },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  return NextResponse.json({ data: invoice })
}
