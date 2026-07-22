// src/lib/businessPdf.ts
// HTML *body* builders for business documents — Invoice/Payment Receipt,
// Payslip, Proposal. These return just the inner content (no letterhead,
// no <html>/<body>), meant to be passed into renderBusinessPdf() from
// lib/pdfRenderer.ts, which wraps them with the company letterhead
// header/footer image and turns them into a real multi-page PDF via
// Puppeteer — same pattern as lib/letterPdf.ts + renderLetterPdf().

function esc(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function fmtINR(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---- Indian-style number to words (for payslip "Amount in Words") ----
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

function statusBadgeClass(status: string): string {
  const s = (status || '').toUpperCase()
  if (['PAID', 'ACCEPTED', 'ACTIVE'].includes(s)) return 'badge-paid'
  if (['OVERDUE', 'REJECTED', 'CANCELLED'].includes(s)) return 'badge-overdue'
  if (['PENDING', 'PARTIAL', 'SENT', 'DRAFT'].includes(s)) return 'badge-pending'
  return 'badge-neutral'
}

export interface CompanyInfo {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyGst?: string
  companyLogoUrl?: string
}

function logoImg(company: CompanyInfo): string {
  return company.companyLogoUrl
    ? `<img src="${esc(company.companyLogoUrl)}" alt="logo" class="company-logo" />`
    : ''
}

// ---------------------------------------------------------------------------
// 1. INVOICE / PAYMENT RECEIPT
// ---------------------------------------------------------------------------
export interface InvoiceDocItem {
  serviceName?: string | null
  description: string
  quantity: number
  unitPrice: number
  total: number
}
export interface InvoiceDocData {
  invoiceNumber: string
  status: string
  createdAt: string | Date
  dueDate?: string | Date | null
  subtotal: number
  discount?: number
  discountType?: string
  gstApplicable?: boolean
  gstRate?: number
  gstAmount?: number
  totalAmount: number
  paidAmount: number
  dueAmount: number
  notes?: string | null
  items: InvoiceDocItem[]
  client: {
    clientName: string
    companyName?: string
    phone?: string | null
    email?: string | null
    gstNo?: string | null
    address?: string | null
  }
  payments?: { amount: number; method: string; paidAt: string | Date; reference?: string | null }[]
  company: CompanyInfo
}

export function buildInvoiceBody(d: InvoiceDocData): string {
  const discountAmount = d.discountType === 'PERCENT' ? d.subtotal * ((d.discount || 0) / 100) : (d.discount || 0)

  return `
  
  <div class="doc-title">TAX INVOICE</div>
  <div class="doc-header">
    <div class="doc-header-left">
      ${logoImg(d.company)}
      <h2 class="company-name">${esc(d.company.companyName)}</h2>
      ${d.company.companyAddress ? `<div style="font-size:11px;color:#64748b;max-width:320px;margin-top:5px;">${esc(d.company.companyAddress)}</div>` : ''}
      <div style="font-size:11px;color:#64748b;margin-top:4px;">
        ${d.company.companyPhone ? `<div>Contact: ${esc(d.company.companyPhone)}</div>` : ''}
        ${d.company.companyEmail ? `<div>Email: ${esc(d.company.companyEmail)}</div>` : ''}
        ${d.company.companyGst ? `<div>GSTIN: ${esc(d.company.companyGst)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-number">${esc(d.invoiceNumber)}</div>
      <div>Date: ${fmtDate(d.createdAt)}</div>
      ${d.dueDate ? `<div>Due: ${fmtDate(d.dueDate)}</div>` : ''}
      <div><span class="badge ${statusBadgeClass(d.status)}">${esc(d.status)}</span></div>
    </div>
  </div>

  <div class="two-col">
    <div class="info-box">
      <div class="section-title">Bill To</div>
      <div style="font-weight:bold;font-size:13.5px;">${esc(d.client.companyName || d.client.clientName)}</div>
      <div>${esc(d.client.clientName)}</div>
      ${d.client.phone ? `<div>${esc(d.client.phone)}</div>` : ''}
      ${d.client.email ? `<div>${esc(d.client.email)}</div>` : ''}
      ${d.client.address ? `<div>${esc(d.client.address)}</div>` : ''}
      ${d.client.gstNo ? `<div>GSTIN: ${esc(d.client.gstNo)}</div>` : ''}
    </div>
  </div>

  <table class="items-table">
    <thead><tr><th style="width:32px;">#</th><th style="width:140px;">Item</th><th>Description</th><th style="width:50px;">Qty</th><th style="width:90px;">Rate</th><th style="width:100px;">Amount</th></tr></thead>
    <tbody>
      ${d.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.serviceName || '—')}</td>
        <td>${esc(item.description)}</td>
        <td>${item.quantity}</td>
        <td>${fmtINR(item.unitPrice)}</td>
        <td>${fmtINR(item.total)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${fmtINR(d.subtotal)}</span></div>
      ${discountAmount > 0 ? `<div class="row"><span>Discount</span><span>-${fmtINR(discountAmount)}</span></div>` : ''}
      ${d.gstApplicable ? `<div class="row"><span>GST (${d.gstRate || 18}%)</span><span>${fmtINR(d.gstAmount || 0)}</span></div>` : ''}
      <div class="row final"><span>Grand Total</span><span>${fmtINR(d.totalAmount)}</span></div>
      <div class="row paid"><span>Paid</span><span>${fmtINR(d.paidAmount)}</span></div>
      <div class="row due"><span>Balance Due</span><span>${fmtINR(d.dueAmount)}</span></div>
    </div>
  </div>

  ${d.payments && d.payments.length > 0 ? `
  <div class="section-title">Payment History</div>
  <table class="items-table" style="margin-bottom:16px;">
    <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th style="width:110px;">Amount</th></tr></thead>
    <tbody>
      ${d.payments.map(p => `
      <tr><td>${fmtDate(p.paidAt)}</td><td>${esc(p.method)}</td><td>${esc(p.reference || '—')}</td><td>${fmtINR(p.amount)}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${d.notes ? `<div class="notes-box"><strong>Notes:</strong> ${esc(d.notes)}</div>` : ''}

  <div class="sig-area">
    <div class="sig">
      <div style="font-weight:bold;color:#dc2626;font-size:12px;">For ${esc(d.company.companyName)}</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>
  `
}

// ---------------------------------------------------------------------------
// 2. PAYSLIP
// ---------------------------------------------------------------------------
export interface PayslipDocData {
  month: string
  year: number
  paidDays: number
  payDate?: string
  employee: { name: string; employeeId: string; position: string; department: string }
  bank: { bankName?: string; accountNumber?: string }
  earnings: { basic: number; hra: number; conveyance: number; medical: number; specialAllow: number }
  deductions: { advance: number; esi: number; pf: number; professionTax: number; tds: number }
  grossEarnings: number
  totalDeduction: number
  netSalary: number
  company: CompanyInfo
}

export function buildPayslipBody(d: PayslipDocData): string {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-IN')
  const e = d.earnings
  const ded = d.deductions
  const totalAddition = e.hra + e.conveyance + e.medical + e.specialAllow

  return `
  
  <div class="doc-header">
    <div class="doc-header-left">
      ${logoImg(d.company)}
      <h2 class="company-name">${esc(d.company.companyName)}</h2>
      ${d.company.companyAddress ? `<div style="font-size:11px;color:#64748b;max-width:320px;margin-top:5px;">${esc(d.company.companyAddress)}</div>` : ''}
    </div>
    <div class="doc-meta">
      <div class="doc-number">PAYSLIP</div>
      <div>${esc(d.month)} ${d.year}</div>
    </div>
  </div>

  <div class="pay-grid">
    <div class="r"><span class="lbl">Employee Name</span><span>: ${esc(d.employee.name)}</span></div>
    <div class="r"><span class="lbl">Bank Name</span><span>: ${esc(d.bank.bankName || '—')}</span></div>
    <div class="r"><span class="lbl">Employee ID</span><span>: ${esc(d.employee.employeeId)}</span></div>
    <div class="r"><span class="lbl">Account No</span><span>: ${esc(d.bank.accountNumber || '—')}</span></div>
    <div class="r"><span class="lbl">Designation</span><span>: ${esc(d.employee.position)}</span></div>
    <div class="r"><span class="lbl">Date</span><span>: ${esc(d.payDate || '')}</span></div>
    <div class="r"><span class="lbl">Department</span><span>: ${esc(d.employee.department)}</span></div>
    <div class="r"><span class="lbl">Paid Days</span><span>: ${d.paidDays}</span></div>
  </div>

  <table class="pay-table" style="width:100%;">
    <tr>
      <th style="width:32%">Gross Earnings</th><th class="amt" style="width:18%">${fmt(d.grossEarnings)}</th>
      <th style="width:32%">Deductions</th><th class="amt" style="width:18%">Amount</th>
    </tr>
    <tr>
      <td>Basic</td><td class="amt">${fmt(e.basic)}</td>
      <td>Advance</td><td class="amt">${fmt(ded.advance)}</td>
    </tr>
    <tr>
      <td>HRA</td><td class="amt">${fmt(e.hra)}</td>
      <td>E.S.I.</td><td class="amt">${fmt(ded.esi)}</td>
    </tr>
    <tr>
      <td>Conveyance</td><td class="amt">${fmt(e.conveyance)}</td>
      <td>Provident Fund</td><td class="amt">${fmt(ded.pf)}</td>
    </tr>
    <tr>
      <td>Medical Allow.</td><td class="amt">${fmt(e.medical)}</td>
      <td>Profession Tax</td><td class="amt">${fmt(ded.professionTax)}</td>
    </tr>
    <tr>
      <td>Special Allow.</td><td class="amt">${fmt(e.specialAllow)}</td>
      <td>TDS/IT</td><td class="amt">${fmt(ded.tds)}</td>
    </tr>
    <tr class="total-row">
      <td>Total Addition</td><td class="amt">${fmt(totalAddition)}</td>
      <td>Total Deduction</td><td class="amt">${fmt(d.totalDeduction)}</td>
    </tr>
    <tr class="net-row">
      <td colspan="2">Amount in Words: ${numberToWordsIndian(d.netSalary)} Only</td>
      <td>NET Salary</td><td class="amt">${fmt(d.netSalary)}</td>
    </tr>
  </table>

  <div class="sig-area">
    <div class="sig">
      <div style="font-weight:bold;font-size:12px;">${esc(d.company.companyName)}</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>
  `
}

// ---------------------------------------------------------------------------
// 3. PROPOSAL
// ---------------------------------------------------------------------------
export interface ProposalDocItem {
  serviceName?: string | null
  description: string
  quantity: number
  unitPrice: number
  total: number
}
export interface ProposalDocData {
  proposalNumber: string
  title: string
  status: string
  createdAt: string | Date
  validUntil?: string | Date | null
  subtotal: number
  discount?: number
  discountType?: string
  gstApplicable?: boolean
  gstRate?: number
  gstAmount?: number
  finalAmount: number
  notes?: string | null
  terms?: string | null
  items: ProposalDocItem[]
  recipient: { name: string; contact?: string; phone?: string; email?: string }
  preparedBy?: string
  company: CompanyInfo
}

export function buildProposalBody(d: ProposalDocData): string {
  const discountAmount = d.discountType === 'PERCENT' ? d.subtotal * ((d.discount || 0) / 100) : (d.discount || 0)

  return `
  
  <div class="doc-title">PROPOSAL</div>
  <div class="doc-header">
    <div class="doc-header-left">
      ${logoImg(d.company)}
      <h2 class="company-name">${esc(d.company.companyName)}</h2>
      ${d.company.companyAddress ? `<div style="font-size:11px;color:#64748b;max-width:320px;margin-top:5px;">${esc(d.company.companyAddress)}</div>` : ''}
      <div style="font-size:11px;color:#64748b;margin-top:4px;">
        ${d.company.companyPhone ? `<div>Contact: ${esc(d.company.companyPhone)}</div>` : ''}
        ${d.company.companyEmail ? `<div>Email: ${esc(d.company.companyEmail)}</div>` : ''}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-number">${esc(d.proposalNumber)}</div>
      <div>Date: ${fmtDate(d.createdAt)}</div>
      ${d.validUntil ? `<div>Valid Until: ${fmtDate(d.validUntil)}</div>` : ''}
      <div><span class="badge ${statusBadgeClass(d.status)}">${esc(d.status)}</span></div>
    </div>
  </div>

  <div class="two-col">
    <div class="info-box">
      <div class="section-title">Prepared For</div>
      <div style="font-weight:bold;font-size:13.5px;">${esc(d.recipient.name)}</div>
      ${d.recipient.contact ? `<div>${esc(d.recipient.contact)}</div>` : ''}
      ${d.recipient.phone ? `<div>${esc(d.recipient.phone)}</div>` : ''}
      ${d.recipient.email ? `<div>${esc(d.recipient.email)}</div>` : ''}
    </div>
    <div class="info-box">
      <div class="section-title">Prepared By</div>
      <div style="font-weight:bold;font-size:13.5px;">${esc(d.preparedBy || d.company.companyName)}</div>
      <div>${esc(d.company.companyName)}</div>
    </div>
  </div>

  <h2 style="font-size:15px;color:#1e293b;margin-bottom:10px;">${esc(d.title)}</h2>

  <table class="items-table">
    <thead><tr><th style="width:32px;">#</th><th style="width:140px;">Item</th><th>Description</th><th style="width:50px;">Qty</th><th style="width:90px;">Rate</th><th style="width:100px;">Amount</th></tr></thead>
    <tbody>
      ${d.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.serviceName || '—')}</td>
        <td>${esc(item.description)}</td>
        <td>${item.quantity}</td>
        <td>${fmtINR(item.unitPrice)}</td>
        <td>${fmtINR(item.total)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${fmtINR(d.subtotal)}</span></div>
      ${discountAmount > 0 ? `<div class="row"><span>Discount</span><span>-${fmtINR(discountAmount)}</span></div>` : ''}
      ${d.gstApplicable ? `<div class="row"><span>GST (${d.gstRate || 18}%)</span><span>${fmtINR(d.gstAmount || 0)}</span></div>` : ''}
      <div class="row final"><span>Total</span><span>${fmtINR(d.finalAmount)}</span></div>
    </div>
  </div>

  ${d.notes ? `<div class="notes-box"><strong>Notes:</strong> ${esc(d.notes)}</div>` : ''}
  ${d.terms ? `<div class="notes-box"><strong>Terms:</strong> ${esc(d.terms)}</div>` : ''}

  <div class="sig-area">
    <div class="sig">
      <div style="font-weight:bold;color:#dc2626;font-size:12px;">For ${esc(d.company.companyName)}</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>
  `
}
