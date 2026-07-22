// src/app/api/invoices/view/[token]/pdf/route.ts
// Public "view invoice PDF" endpoint — mirrors /api/proposals/view/[token]/pdf.
// No session required; the unguessable shareToken IS the access control,
// same as the existing /api/invoices/view/[token] JSON endpoint. This is
// what the "Share Link" button now points to (replacing the old
// /invoice/view/[token] HTML page, which just duplicated this PDF's design).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildInvoiceBody, CompanyInfo } from '@/lib/businessPdf'
import { renderBusinessPdf } from '@/lib/pdfRenderer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invoice = await prisma.invoice.findFirst({
    where: { shareToken: token },
    include: { client: true, items: true, payments: { orderBy: { paidAt: 'desc' } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const settings = await prisma.setting.findMany({
    where: { key: { in: ['company_name', 'company_email', 'company_phone', 'company_address', 'company_gst', 'company_logo_url'] } },
  })
  const settingsMap: Record<string, string> = {}
  settings.forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value })

  const company: CompanyInfo = {
    companyName: settingsMap.company_name || 'Hover Business Services LLP',
    companyAddress: settingsMap.company_address || undefined,
    companyPhone: settingsMap.company_phone || undefined,
    companyEmail: settingsMap.company_email || undefined,
    companyGst: settingsMap.company_gst || undefined,
    companyLogoUrl: settingsMap.company_logo_url || undefined,
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
