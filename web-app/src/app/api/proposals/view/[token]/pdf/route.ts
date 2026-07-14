// src/app/api/proposals/view/[token]/pdf/route.ts
// Public "view proposal PDF" endpoint — mirrors /api/proposals/[id]/pdf but
// authenticated by the unguessable shareToken instead of a session, exactly
// like /api/proposals/view/[token] (the JSON version used by the client
// portal page). Returns a real server-rendered PDF (Puppeteer) with the
// company letterhead header/footer repeating on every page.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildProposalBody, CompanyInfo } from '@/lib/businessPdf'
import { renderBusinessPdf } from '@/lib/pdfRenderer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const p = await prisma.proposal.findFirst({
    where: { shareToken: token },
    include: { client: true, lead: true, items: true, createdBy: { select: { name: true } } },
  })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recipient = p.client
    ? { name: p.client.companyName, contact: p.client.clientName, phone: p.client.phone || undefined, email: p.client.email || undefined }
    : p.lead
    ? { name: p.lead.companyName || p.lead.clientName, contact: p.lead.clientName, phone: p.lead.clientPhone || undefined, email: p.lead.clientEmail || undefined }
    : { name: '—', contact: '—' }

  const settings = await prisma.setting.findMany({
    where: { key: { in: ['company_name', 'company_email', 'company_phone', 'company_address'] } },
  })
  const settingsMap: Record<string, string> = {}
  settings.forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value })

  const company: CompanyInfo = {
    companyName: settingsMap.company_name || 'Hover Business Services LLP',
    companyAddress: settingsMap.company_address || undefined,
    companyPhone: settingsMap.company_phone || undefined,
    companyEmail: settingsMap.company_email || undefined,
  }

  const bodyHtml = buildProposalBody({
    proposalNumber: p.proposalNumber,
    title: p.title,
    status: p.status === 'SENT' ? 'VIEWED' : p.status,
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
