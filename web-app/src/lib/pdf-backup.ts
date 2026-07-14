// src/lib/pdf.ts
// PDF generation utilities for invoices, proposals, payslips
// Uses jsPDF library

export interface InvoiceData {
  invoiceNumber: string
  date: string
  dueDate?: string
  client: {
    clientName: string
    companyName: string
    email: string
    phone: string
    address?: string
  }
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  tax: number
  discount: number
  total: number
  paidAmount: number
  dueAmount: number
  companyName: string
  companyEmail: string
  gstNumber?: string
}

export interface ProposalData {
  proposalNumber: string
  date: string
  validUntil?: string
  client: {
    clientName: string
    companyName: string
    email: string
  }
  items: Array<{
    service: string
    description?: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  discount: number
  total: number
  notes?: string
  companyName: string
  companyEmail: string
}

export interface PayslipData {
  month: string
  year: number
  paidDays: number
  employee: {
    name: string
    employeeId: string
    position: string
    department: string
  }
  bank: {
    bankName?: string
    accountNumber?: string
  }
  earnings: {
    basic: number
    hra: number
    conveyance: number
    medical: number
    specialAllow: number
  }
  deductions: {
    advance: number
    esi: number
    pf: number
    professionTax: number
    tds: number
  }
  grossEarnings: number
  totalDeduction: number
  netSalary: number
  companyName: string
  companyAddress?: string
  companyLogoUrl?: string
  payDate?: string
}

// ---- Indian-style number to words (for "Amount in Words") ----
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

// These functions are meant to be called client-side with jsPDF
export function generateInvoicePDFContent(data: InvoiceData): string {
  // Returns HTML string for PDF generation
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company { font-size: 24px; font-weight: bold; color: #2563eb; }
    .invoice-title { font-size: 32px; font-weight: bold; color: #1e40af; text-align: right; }
    .invoice-number { color: #64748b; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.5px; }
    .info-box { background: #f8fafc; padding: 16px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1e40af; color: white; padding: 12px; text-align: left; font-size: 12px; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    .totals { margin-top: 24px; margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .total-final { font-weight: bold; font-size: 18px; color: #1e40af; border-top: 2px solid #1e40af; padding-top: 8px; margin-top: 8px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; }
    .badge-paid { background: #dcfce7; color: #16a34a; }
    .badge-pending { background: #fef9c3; color: #ca8a04; }
    .footer { margin-top: 60px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${data.companyName}</div>
      <div style="color:#64748b;margin-top:4px;">${data.companyEmail}</div>
      ${data.gstNumber ? `<div style="color:#64748b;font-size:12px;">GST: ${data.gstNumber}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-number">#${data.invoiceNumber}</div>
      <div style="margin-top:8px;color:#64748b;font-size:13px;">Date: ${data.date}</div>
      ${data.dueDate ? `<div style="color:#64748b;font-size:13px;">Due: ${data.dueDate}</div>` : ''}
    </div>
  </div>

  <div style="display:flex;gap:24px;margin-bottom:32px;">
    <div style="flex:1;">
      <div class="section-title">Bill To</div>
      <div class="info-box">
        <strong>${data.client.clientName}</strong><br>
        ${data.client.companyName}<br>
        ${data.client.email}<br>
        ${data.client.phone}
        ${data.client.address ? `<br>${data.client.address}` : ''}
      </div>
    </div>
    <div style="flex:1;">
      <div class="section-title">Payment Status</div>
      <div class="info-box">
        <span class="badge ${data.dueAmount === 0 ? 'badge-paid' : 'badge-pending'}">
          ${data.dueAmount === 0 ? 'PAID' : 'PENDING'}
        </span>
        <div style="margin-top:8px;font-size:13px;">
          <div>Paid: ₹${data.paidAmount.toLocaleString('en-IN')}</div>
          <div>Due: ₹${data.dueAmount.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.items.map((item, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>₹${item.unitPrice.toLocaleString('en-IN')}</td>
          <td>₹${item.total.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>₹${data.subtotal.toLocaleString('en-IN')}</span></div>
    ${data.tax > 0 ? `<div class="total-row"><span>Tax (18% GST)</span><span>₹${data.tax.toLocaleString('en-IN')}</span></div>` : ''}
    ${data.discount > 0 ? `<div class="total-row"><span>Discount</span><span>-₹${data.discount.toLocaleString('en-IN')}</span></div>` : ''}
    <div class="total-row total-final"><span>Total</span><span>₹${data.total.toLocaleString('en-IN')}</span></div>
  </div>

  <div class="footer">
    Thank you for your business! • ${data.companyName} • ${data.companyEmail}
  </div>
</body>
</html>
  `
}

export function generatePayslipHTML(data: PayslipData): string {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-IN')
  const e = data.earnings
  const d = data.deductions
  const totalAddition = e.hra + e.conveyance + e.medical + e.specialAllow

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; }
    .logo-wrap { text-align: center; margin-bottom: 8px; }
    .logo-wrap img { max-height: 70px; }
    .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 4px; }
    .company-name { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 4px; }
    .company-address { text-align: center; font-size: 12px; color: #333; margin-bottom: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 20px; font-size: 13px; }
    .info-row { display: flex; }
    .info-label { width: 110px; font-weight: bold; }
    .info-colon { width: 14px; }
    .pay-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 0; }
    .pay-table td, .pay-table th { border: 1px solid #999; padding: 7px 10px; }
    .pay-table th { background: #f1f5f9; text-align: left; font-weight: bold; }
    .amt { text-align: right; }
    .total-row td { font-weight: bold; background: #f8fafc; }
    .net-row td { font-weight: bold; background: #1e40af; color: white; font-size: 14px; }
    .footer { margin-top: 60px; font-size: 13px; }
    .footer .sig-line { margin-top: 50px; border-top: 1px solid #999; width: 220px; padding-top: 4px; color: #555; }
  </style>
</head>
<body>
  ${data.companyLogoUrl ? `<div class="logo-wrap"><img src="${data.companyLogoUrl}" alt="logo" /></div>` : ''}
  <div class="title">PAYSLIP</div>
  <div class="company-name">${data.companyName}</div>
  ${data.companyAddress ? `<div class="company-address">${data.companyAddress}</div>` : ''}

  <div class="info-grid">
    <div class="info-row"><span class="info-label">Employee Name</span><span class="info-colon">:</span><span>${data.employee.name}</span></div>
    <div class="info-row"><span class="info-label">Bank Name</span><span class="info-colon">:</span><span>${data.bank.bankName || '—'}</span></div>
    <div class="info-row"><span class="info-label">Designation</span><span class="info-colon">:</span><span>${data.employee.department}</span></div>
    <div class="info-row"><span class="info-label">Account No</span><span class="info-colon">:</span><span>${data.bank.accountNumber || '—'}</span></div>
    <div class="info-row"><span class="info-label">Month</span><span class="info-colon">:</span><span>${data.month} ${data.year}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-colon">:</span><span>${data.payDate || ''}</span></div>
    <div class="info-row"></div>
    <div class="info-row"><span class="info-label">Paid Days</span><span class="info-colon">:</span><span>${data.paidDays}</span></div>
  </div>

  <table class="pay-table">
    <tr>
      <th style="width:32%">Gross Earnings</th><th class="amt" style="width:18%">${fmt(data.grossEarnings)}</th>
      <th style="width:32%">Deductions</th><th class="amt" style="width:18%">Amount</th>
    </tr>
    <tr>
      <td>Basic</td><td class="amt">${fmt(e.basic)}</td>
      <td>Advance</td><td class="amt">${fmt(d.advance)}</td>
    </tr>
    <tr>
      <td>HRA</td><td class="amt">${fmt(e.hra)}</td>
      <td>E.S.I.</td><td class="amt">${fmt(d.esi)}</td>
    </tr>
    <tr>
      <td>Conveyance</td><td class="amt">${fmt(e.conveyance)}</td>
      <td>Provident Fund</td><td class="amt">${fmt(d.pf)}</td>
    </tr>
    <tr>
      <td>Medical Allow.</td><td class="amt">${fmt(e.medical)}</td>
      <td>Profession Tax</td><td class="amt">${fmt(d.professionTax)}</td>
    </tr>
    <tr>
      <td>Special Allow.</td><td class="amt">${fmt(e.specialAllow)}</td>
      <td>TDS/IT</td><td class="amt">${fmt(d.tds)}</td>
    </tr>
    <tr class="total-row">
      <td>Total Addition</td><td class="amt">${fmt(totalAddition)}</td>
      <td>Total Deduction</td><td class="amt">${fmt(data.totalDeduction)}</td>
    </tr>
    <tr class="net-row">
      <td colspan="2">Amount in Words: - ${numberToWordsIndian(data.netSalary)} Only</td>
      <td>NET Salary</td><td class="amt">${fmt(data.netSalary)}</td>
    </tr>
  </table>

  <div class="footer">
    <strong>${data.companyName}</strong>
    <div class="sig-line">Authorized Signatory</div>
  </div>
</body>
</html>
  `
}