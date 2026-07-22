// src/app/api/proposals/[id]/pdf/route.ts
// Real server-rendered PDF (Puppeteer) with the company letterhead
// header/footer repeating on every page — same pattern as the letters
// module. Session-protected (admin dashboard). For the public share-link
// view, see /api/proposals/view/[token]/pdf.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { Settings } from '@/lib/settings'
import { buildProposalBody, CompanyInfo } from '@/lib/businessPdf'
import { renderBusinessPdf } from '@/lib/pdfRenderer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = await prisma.proposal.findUnique({
    where: { id: id },
    include: { client: true, lead: true, items: true, createdBy: { select: { name: true } } },
  })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recipient = p.client
    ? { name: p.client.companyName, contact: p.client.clientName, phone: p.client.phone || undefined, email: p.client.email || undefined }
    : p.lead
    ? { name: p.lead.companyName || p.lead.clientName, contact: p.lead.clientName, phone: p.lead.clientPhone || undefined, email: p.lead.clientEmail || undefined }
    : { name: '—', contact: '—' }

  const [companyName, companyAddress, companyPhone, companyEmail, companyLogoUrl] = await Promise.all([
    Settings.companyName(),
    Settings.companyAddress(),
    Settings.companyPhone(),
    Settings.companyEmail(),
    Settings.companyLogo(),
  ])

  const company: CompanyInfo = {
    companyName: companyName || 'Hover Business Services LLP',
    companyAddress: companyAddress || undefined,
    companyPhone: companyPhone || undefined,
    companyEmail: companyEmail || undefined,
    companyLogoUrl: companyLogoUrl || undefined,
  }

  const bodyHtml = buildProposalBody({
    proposalNumber: p.proposalNumber,
    title: p.title,
    status: p.status,
    createdAt: p.createdAt,
    validUntil: p.validUntil,
    subtotal: p.subtotal,
    discount: p.discount,
    discountType: p.discountType,
    gstApplicable: p.gstApplicable,
    gstRate: p.gstRate,
    gstAmount: p.gstAmount,
    finalAmount: p.finalAmount,
    notes: p.notes,
    terms: p.terms,
    items: p.items,
    recipient,
    preparedBy: p.createdBy.name,
    company,
  })

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderBusinessPdf(bodyHtml, `Proposal ${p.proposalNumber}`)
  } catch (err) {
    console.error('Proposal PDF render failed:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  const fileName = `Proposal-${p.proposalNumber}.pdf`

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
