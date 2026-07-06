import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = await prisma.proposal.findUnique({
    where: { id: id },
    include: { client: true, lead: true, items: true, createdBy: { select: { name: true } } },
  })
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const recipient = p.client ? { name: p.client.companyName, contact: p.client.clientName, phone: p.client.phone } : p.lead ? { name: p.lead.companyName || p.lead.clientName, contact: p.lead.clientName, phone: p.lead.clientPhone } : { name: '—', contact: '—', phone: '—' }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposal ${p.proposalNumber}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#1f2937;max-width:800px;margin:0 auto}
    h1{color:#1d4ed8;margin:0}.header{display:flex;justify-content:space-between;margin-bottom:40px}
    table{width:100%;border-collapse:collapse;margin:24px 0}th{background:#f3f4f6;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280}
    td{padding:10px;border-bottom:1px solid #f3f4f6}.totals{margin-left:auto;width:240px}
    .total-row{display:flex;justify-content:space-between;padding:6px 0}.total-final{font-size:18px;font-weight:700;border-top:2px solid #1d4ed8;margin-top:8px;padding-top:8px}
    .badge{display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;background:#dbeafe;color:#1d4ed8}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="header">
    <div><h1>Hover Business Services LLP</h1><p style="color:#d81d1d;margin:4px 0">Business Proposal</p></div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:700;color:#1d4ed8">${p.proposalNumber}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px">Date: ${new Date(p.createdAt).toLocaleDateString('en-IN')}</div>
      ${p.validUntil ? `<div style="color:#6b7280;font-size:13px">Valid Until: ${new Date(p.validUntil).toLocaleDateString('en-IN')}</div>` : ''}
      <span class="badge">${p.status}</span>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
    <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600">Prepared For</div>
    <div style="font-weight:700;font-size:16px;margin-top:4px">${recipient.name}</div>
    <div>${recipient.contact}</div><div>${recipient.phone}</div></div>
    <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600">Prepared By</div>
    <div style="font-weight:700;font-size:16px;margin-top:4px">${p.createdBy.name}</div>
    <div>Hover Business Services LLP</div></div>
  </div>
  <h2 style="font-size:18px;color:#1f2937;margin-bottom:8px">${p.title}</h2>
  <table><thead><tr><th>#</th><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody>${p.items.map((item, i) => `<tr><td>${i+1}</td><td>${item.serviceName}</td><td>${item.description}</td><td>${item.quantity}</td><td>₹${item.unitPrice.toLocaleString('en-IN')}</td><td>₹${item.total.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end">
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>₹${p.totalAmount.toLocaleString('en-IN')}</span></div>
      <div class="total-row"><span>Discount</span><span>-₹${p.discount.toLocaleString('en-IN')}</span></div>
      <div class="total-row total-final"><span>Total</span><span>₹${p.finalAmount.toLocaleString('en-IN')}</span></div>
    </div>
  </div>
  ${p.notes ? `<div style="margin-top:32px;padding:16px;background:#f9fafb;border-radius:8px"><strong>Notes / Terms:</strong><br>${p.notes}</div>` : ''}
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
