// src/lib/invoicePdf.ts
// Generate a professional invoice PDF client-side using jsPDF + autoTable.
// Same generator used for both admin and client portal downloads.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface InvoiceItem {
  serviceName?: string | null
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface InvoiceData {
  invoiceNumber: string
  createdAt: string | Date
  dueDate?: string | Date | null
  status: string
  subtotal: number
  discount?: number
  discountType?: string
  gstApplicable?: boolean
  gstRate?: number
  gstAmount?: number
  totalAmount: number
  paidAmount?: number
  dueAmount?: number
  paidVia?: 'CASH' | 'CHEQUE' | 'ONLINE' | null
  notes?: string | null
  terms?: string | null
  items: InvoiceItem[]
  client: {
    clientCode?: string
    clientName: string
    companyName?: string
    phone?: string | null
    email?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    gstNo?: string | null
    pincode?: string | null
  }
}

interface CompanyInfo {
  name?: string
  addressLines?: string[]
  address?: string
  phone?: string
  email?: string
  gstNo?: string
  logoUrl?: string
  state?: string
  bank?: {
    bankName?: string
    accountName?: string
    accountNo?: string
    accountType?: string
    ifsc?: string
  }
}

const fmt = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ---- Indian-style number to words (for "Total invoice value in words") ----
function numberToWordsIndian(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const two = (n: number): string => {
    if (n < 20) return ones[n]
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`
  }
  const three = (n: number): string => {
    if (n >= 100) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + two(n % 100) : ''}`
    return two(n)
  }

  const n = Math.round(num)
  if (n === 0) return 'Zero'

  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const rest = n % 1000

  const parts: string[] = []
  if (crore) parts.push(`${three(crore)} Crore`)
  if (lakh) parts.push(`${three(lakh)} Lakh`)
  if (thousand) parts.push(`${three(thousand)} Thousand`)
  if (rest) parts.push(three(rest))

  return parts.join(' ')
}

export function generateInvoicePdf(invoice: InvoiceData, company: CompanyInfo = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 15

  // ============ TITLE ============
  doc.setTextColor(0)
  doc.setFontSize(20).setFont('helvetica', 'bold')
  doc.text('INVOICE', W / 2, 18, { align: 'center' })

  // ============ COMPANY (LEFT) + META (RIGHT) ============
  let y = 28
  doc.setFontSize(13).setFont('helvetica', 'bold')
  doc.setTextColor(200, 30, 30)
  doc.text(company.name || 'Hover Business Services', M, y)
  doc.setTextColor(0)

  const compAddrLines = company.addressLines || (company.address ? company.address.split('\n') : [])
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(50)
  let cy = y + 5
  compAddrLines.forEach(l => { doc.text(l, M, cy); cy += 3.8 })
  const contactBits: string[] = []
  if (company.phone) contactBits.push(`Contact: ${company.phone}`)
  if (company.email) contactBits.push(`Email: ${company.email}`)
  contactBits.forEach(l => { doc.text(l, M, cy); cy += 3.8 })

  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(0)
  const metaX = W - M
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, metaX, y, { align: 'right' })
  doc.text(`Date: ${fmtDate(invoice.createdAt)}`, metaX, y + 5, { align: 'right' })
  if (company.state) doc.text(`State: ${company.state}`, metaX, y + 10, { align: 'right' })
  if (invoice.dueDate) doc.text(`Due Date: ${fmtDate(invoice.dueDate)}`, metaX, y + 15, { align: 'right' })
  doc.setFont('helvetica', 'bold').text(`Status: ${invoice.status}`, metaX, y + 20, { align: 'right' })
  doc.setFont('helvetica', 'normal')

  y = Math.max(cy, y + 25) + 3
  doc.setDrawColor(0).setLineWidth(0.5)
  doc.line(M, y, W - M, y)
  y += 6

  // ============ PREPARED FOR / BILL TO ============
  // Same field order and two-column grid as the proposal document, plus
  // billing-specific extras (address, GST no) appended below.
  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(120)
  doc.text('BILL TO', M, y)
  y += 4.5
  doc.setFontSize(9).setTextColor(0)

  const colGap = W / 2 + 5
  const grid: [string, string, string, string][] = [
    ['Client Name:', invoice.client.clientName, 'Contact No:', invoice.client.phone || '-'],
    ['Company Name:', invoice.client.companyName || '-', 'Email ID:', invoice.client.email || '-'],
  ]
  let gy = y
  grid.forEach(([lLabel, lVal, rLabel, rVal]) => {
    doc.setFont('helvetica', 'bold').text(lLabel, M, gy)
    doc.setFont('helvetica', 'normal').text(String(lVal), M + 26, gy, { maxWidth: colGap - M - 28 })
    doc.setFont('helvetica', 'bold').text(rLabel, colGap, gy)
    doc.setFont('helvetica', 'normal').text(String(rVal), colGap + 22, gy, { maxWidth: W - M - colGap - 24 })
    gy += 5
  })

  const addr = [invoice.client.address, invoice.client.city, invoice.client.state, invoice.client.pincode].filter(Boolean).join(', ')
  if (addr) {
    doc.setFont('helvetica', 'bold').text('Address:', M, gy)
    doc.setFont('helvetica', 'normal').text(addr, M + 26, gy, { maxWidth: W - M - 26 })
    gy += 5
  }
  if (invoice.client.gstNo) {
    doc.setFont('helvetica', 'bold').text('GST No:', M, gy)
    doc.setFont('helvetica', 'normal').text(invoice.client.gstNo, M + 26, gy)
    gy += 5
  }

  y = gy + 3

  // ============ ITEMS TABLE ============
  // Column order matches the proposal document: Sr No, Service, Description, Qty, Rate, Net Amount.
  autoTable(doc, {
    startY: y,
    head: [['Sr No', 'Service', 'Description', 'Qty', 'Rate', 'Net Amount']],
    body: invoice.items.map((it, i) => [
      String(i + 1),
      it.serviceName || '-',
      it.description || '-',
      String(it.quantity),
      fmt(it.unitPrice),
      fmt(it.total),
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'top', lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 68 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: M, right: M },
    theme: 'grid',
  })

  y = (doc as any).lastAutoTable.finalY + 6

  // ============ PAYMENT MODE + WORDS (LEFT) & TOTALS (RIGHT) ============
  const totalsBoxW = 65
  const totalsBoxX = W - M - totalsBoxW
  let boxY = y

  const drawCheckbox = (x: number, cyy: number, checked: boolean, label: string) => {
    doc.setDrawColor(0).setLineWidth(0.3)
    doc.rect(x, cyy - 3, 3, 3)
    if (checked) {
      doc.setFontSize(7).setFont('helvetica', 'bold').text('X', x + 0.5, cyy - 0.6)
    }
    doc.setFontSize(8.5).setFont('helvetica', 'normal').text(label, x + 5, cyy)
  }

  doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(0)
  doc.text('Mode of Payment:', M, boxY)
  drawCheckbox(M, boxY + 6, invoice.paidVia === 'CASH', 'Cash')
  drawCheckbox(M + 22, boxY + 6, invoice.paidVia === 'CHEQUE', 'Cheque')
  drawCheckbox(M + 46, boxY + 6, invoice.paidVia === 'ONLINE', 'Online')

  let leftY = boxY + 14
  doc.setFontSize(8.5).setFont('helvetica', 'bold')
  doc.text('Total invoice value (in words):', M, leftY)
  doc.setFont('helvetica', 'normal')
  leftY += 4
  doc.text(`${numberToWordsIndian(invoice.totalAmount)} Only`, M, leftY, { maxWidth: totalsBoxX - M - 5 })
  leftY += 6

  doc.setFont('helvetica', 'bold')
  doc.text('Payment Status:', M, leftY)
  doc.setFont('helvetica', 'normal')
  const payStatus = invoice.dueAmount && invoice.dueAmount > 0 ? `${invoice.paidVia || 'Online'} - Pending` : 'Paid'
  doc.text(` ${payStatus}`, M + 28, leftY)
  leftY += 7

  if (company.bank) {
    doc.setFont('helvetica', 'bold')
    doc.text('Bank Details:', M, leftY)
    leftY += 4.5
    doc.setFont('helvetica', 'normal').setFontSize(8)
    const bankLines = [
      company.bank.bankName ? `Bank: ${company.bank.bankName}` : '',
      company.bank.accountName ? `Account Name: ${company.bank.accountName}` : '',
      company.bank.accountNo ? `Account No: ${company.bank.accountNo}` : '',
      company.bank.accountType ? `Account Type: ${company.bank.accountType}` : '',
      company.bank.ifsc ? `IFSC: ${company.bank.ifsc}` : '',
    ].filter(Boolean)
    bankLines.forEach(l => { doc.text(l, M, leftY); leftY += 3.8 })
  }

  // Totals box (bordered, right side)
  const lineH = 6
  doc.setDrawColor(0).setLineWidth(0.3)
  const rows: [string, string, boolean, [number, number, number]?][] = []
  rows.push(['Total Amount', fmt(invoice.subtotal), false])
  if (invoice.discount && invoice.discount > 0) {
    const discAmount = invoice.discountType === 'PERCENT'
      ? invoice.subtotal * (invoice.discount / 100)
      : invoice.discount
    rows.push([`Discount${invoice.discountType === 'PERCENT' ? ` (${invoice.discount}%)` : ''}`, `- ${fmt(discAmount)}`, false, [200, 30, 30]])
  }
  if (invoice.gstApplicable && invoice.gstAmount) {
    rows.push([`GST (${invoice.gstRate}%)`, fmt(invoice.gstAmount), false])
  }
  rows.push(['Grand Total', fmt(invoice.totalAmount), true])
  if (invoice.paidAmount && invoice.paidAmount > 0) {
    rows.push(['Paid', fmt(invoice.paidAmount), false, [16, 130, 90]])
    rows.push(['Balance Due', fmt(invoice.dueAmount || 0), true, [200, 30, 30]])
  }

  rows.forEach(([label, val, bold, color]) => {
    doc.rect(totalsBoxX, boxY - 4.5, totalsBoxW, lineH)
    doc.setFontSize(8.5).setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...(color || [0, 0, 0]))
    doc.text(label, totalsBoxX + 2, boxY)
    doc.text(val, totalsBoxX + totalsBoxW - 2, boxY, { align: 'right' })
    doc.setTextColor(0)
    boxY += lineH
  })

  y = Math.max(leftY, boxY) + 6

  // ============ TERMS & CONDITIONS ============
  if (invoice.terms) {
    doc.setDrawColor(200).setLineWidth(0.2)
    doc.line(M, y, W - M, y)
    y += 5
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(0)
    doc.text('Terms & Conditions:', M, y)
    y += 4.5
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(50)
    const termLines = invoice.terms.split('\n').filter(Boolean)
    termLines.forEach(line => {
      const wrapped = doc.splitTextToSize(`• ${line}`, W - 2 * M - 4)
      doc.text(wrapped, M + 2, y)
      y += 3.8 * wrapped.length
    })
    y += 2
  }

  if (invoice.notes) {
    doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(0)
    doc.text('Notes:', M, y)
    y += 4.5
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(50)
    const wrapped = doc.splitTextToSize(invoice.notes, W - 2 * M)
    doc.text(wrapped, M, y)
    y += 3.8 * wrapped.length
  }

  // ============ SIGNATURE ============
  const sigY = Math.max(y + 15, doc.internal.pageSize.getHeight() - 30)
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(200, 30, 30)
  doc.text(`For ${company.name || 'Your Company'}`, W - M, sigY, { align: 'right' })
  doc.setDrawColor(0).setLineWidth(0.2)
  doc.line(W - M - 45, sigY + 10, W - M, sigY + 10)
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(80)
  doc.text('Authorised Signatory', W - M, sigY + 14, { align: 'right' })

  // ============ FOOTER ============
  const footerY = doc.internal.pageSize.getHeight() - 10
  doc.setDrawColor(220)
  doc.line(M, footerY - 3, W - M, footerY - 3)
  doc.setFontSize(7.5).setTextColor(140).setFont('helvetica', 'italic')
  doc.text('This is a computer-generated invoice and does not require a physical signature.', W / 2, footerY, { align: 'center' })

  return doc
}

export function downloadInvoicePdf(invoice: InvoiceData, company: CompanyInfo = {}) {
  const doc = generateInvoicePdf(invoice, company)
  doc.save(`${invoice.invoiceNumber}.pdf`)
}