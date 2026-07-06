import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invoice = await prisma.invoice.findUnique({
    where: { id: id },
    include: { client: true, items: true, payments: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#1f2937;max-width:800px;margin:0 auto}
    h1{color:#1d4ed8;margin:0}.header{display:flex;justify-content:space-between;margin-bottom:40px}
    .inv-num{font-size:24px;font-weight:700;color:#1d4ed8}.status{display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;background:#dbeafe;color:#1d4ed8}
    table{width:100%;border-collapse:collapse;margin:24px 0}th{background:#f3f4f6;padding:10px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280}
    td{padding:10px;border-bottom:1px solid #f3f4f6}.totals{margin-left:auto;width:240px}
    .total-row{display:flex;justify-content:space-between;padding:6px 0}.total-final{font-size:18px;font-weight:700;border-top:2px solid #1d4ed8;margin-top:8px;padding-top:8px}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="header">
    <div><h1>Hover Business Services LLP</h1><p style="color:#d81d1d;margin:4px 0">Tax Invoice</p></div>
    <div style="text-align:right">
      <div class="inv-num">${invoice.invoiceNumber}</div>
      <div style="color:#6b7280;font-size:13px;margin-top:4px">Date: ${new Date(invoice.createdAt).toLocaleDateString('en-IN')}</div>
      ${invoice.dueDate ? `<div style="color:#6b7280;font-size:13px">Due: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</div>` : ''}
      <span class="status">${invoice.status}</span>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
    <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:600">Bill To</div>
    <div style="font-weight:700;font-size:16px;margin-top:4px">${invoice.client.companyName}</div>
    <div>${invoice.client.clientName}</div>
    ${invoice.client.phone ? `<div>${invoice.client.phone}</div>` : ''}
    ${invoice.client.gstNo ? `<div>GST: ${invoice.client.gstNo}</div>` : ''}</div>
  </div>
  <table><thead><tr><th>#</th><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody>${invoice.items.map((item, i) => `<tr><td>${i+1}</td><td>${item.serviceName}</td><td>${item.description}</td><td>${item.quantity}</td><td>₹${item.unitPrice.toLocaleString('en-IN')}</td><td>₹${item.total.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end">
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>₹${invoice.totalAmount.toLocaleString('en-IN')}</span></div>
      <div class="total-row"><span>Paid</span><span style="color:#16a34a">₹${invoice.paidAmount.toLocaleString('en-IN')}</span></div>
      <div class="total-row total-final"><span>Balance Due</span><span style="color:${invoice.dueAmount>0?'#dc2626':'#16a34a'}">₹${invoice.dueAmount.toLocaleString('en-IN')}</span></div>
    </div>
  </div>
  ${invoice.notes ? `<div style="margin-top:32px;padding:16px;background:#f9fafb;border-radius:8px"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
