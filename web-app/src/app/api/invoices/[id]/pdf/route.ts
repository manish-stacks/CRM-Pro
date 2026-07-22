// src/app/api/invoices/[id]/pdf/route.ts
// Real server-rendered PDF (Puppeteer) with the company letterhead
// header/footer repeating on every page — same pattern as the letters
// module. Used by the admin dashboard invoice detail page.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { Settings } from '@/lib/settings'
import { buildInvoiceBody, CompanyInfo } from '@/lib/businessPdf'
import { renderBusinessPdf } from '@/lib/pdfRenderer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoice = await prisma.invoice.findUnique({
    where: { id: id },
    include: { client: true, items: true, payments: { orderBy: { paidAt: 'desc' } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [companyName, companyAddress, companyPhone, companyEmail, companyGst, companyLogoUrl] = await Promise.all([
    Settings.companyName(),
    Settings.companyAddress(),
    Settings.companyPhone(),
    Settings.companyEmail(),
    Settings.companyGst(),
    Settings.companyLogo(),
  ])

  const company: CompanyInfo = {
    companyName: companyName || 'Hover Business Services LLP',
    companyAddress: companyAddress || undefined,
    companyPhone: companyPhone || undefined,
    companyEmail: companyEmail || undefined,
    companyGst: companyGst || undefined,
    companyLogoUrl: companyLogoUrl || undefined,
  }

  const bodyHtml = buildInvoiceBody({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    discountType: invoice.discountType,
    gstApplicable: invoice.gstApplicable,
    gstRate: invoice.gstRate,
    gstAmount: invoice.gstAmount,
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    dueAmount: invoice.dueAmount,
    notes: invoice.notes,
    items: invoice.items,
    client: {
      clientName: invoice.client.clientName,
      companyName: invoice.client.companyName,
      phone: invoice.client.phone,
      email: invoice.client.email,
      gstNo: invoice.client.gstNo,
      address: invoice.client.address,
    },
    payments: invoice.payments,
    company,
  })

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderBusinessPdf(bodyHtml, `Invoice ${invoice.invoiceNumber}`)
  } catch (err) {
    console.error('Invoice PDF render failed:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  const fileName = `Invoice-${invoice.invoiceNumber}.pdf`

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
