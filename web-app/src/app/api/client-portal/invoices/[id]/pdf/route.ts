// src/app/api/client-portal/invoices/[id]/pdf/route.ts
// Server-rendered "view invoice/receipt PDF" for the client portal — same
// buildInvoiceBody + renderBusinessPdf pipeline already used by the admin
// download and the public share-link, opened directly in a new tab (like
// admin's "PDF" button) instead of relying on client-side jsPDF generation,
// which is more fragile (popup blockers, blob download quirks) and was
// reported as "invoice/receipt won't open" from the client dashboard.
import { NextRequest, NextResponse } from 'next/server'
import { BRAND } from '@/lib/branding'
import { prisma } from '@/lib/prisma'
import { getClientSession } from '@/lib/clientAuth'
import { Settings } from '@/lib/settings'
import { buildInvoiceBody, CompanyInfo } from '@/lib/businessPdf'
import { renderBusinessPdf } from '@/lib/pdfRenderer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoice = await prisma.invoice.findFirst({
    where: { id, clientId: session.clientId },
    include: { client: true, items: true, payments: { orderBy: { paidAt: 'desc' } } },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const [companyName, companyAddress, companyPhone, companyEmail, companyGst, companyLogoUrl, companySignatureUrl] = await Promise.all([
    Settings.companyName(),
    Settings.companyAddress(),
    Settings.companyPhone(),
    Settings.companyEmail(),
    Settings.companyGst(),
    Settings.companyLogo(),
    Settings.companySignature(),
  ])

  const company: CompanyInfo = {
    companyName: companyName || BRAND.name,
    companyAddress: companyAddress || undefined,
    companyPhone: companyPhone || undefined,
    companyEmail: companyEmail || undefined,
    companyGst: companyGst || undefined,
    companyLogoUrl: companyLogoUrl || undefined,
    companySignatureUrl: companySignatureUrl || undefined,
  }

  const bodyHtml = buildInvoiceBody({
    invoiceNumber: invoice.invoiceNumber,
    docType: invoice.docType,
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
    pdfBuffer = await renderBusinessPdf(bodyHtml, `${invoice.docType === 'RECEIPT' ? 'Receipt' : 'Invoice'} ${invoice.invoiceNumber}`)
  } catch (err) {
    console.error('Client-portal invoice PDF render failed:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  const fileName = `${invoice.docType === 'RECEIPT' ? 'Receipt' : 'Invoice'}-${invoice.invoiceNumber}.pdf`

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
