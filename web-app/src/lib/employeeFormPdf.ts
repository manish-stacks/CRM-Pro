// src/lib/employeeFormPdf.ts
// Admin-only: generates a printable "Employee Details" PDF that mirrors the
// company's paper intake form (logo header, photo box, boxed sections for
// Personal/Family/Documents/Medical/Bank/Office-use details) — used from the
// employee detail page so Admin/HR can download/print a hard copy.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './utils'
import { BRAND } from './branding'

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const absUrl = typeof window !== 'undefined' && url.startsWith('/') ? window.location.origin + url : url
    const res = await fetch(absUrl)
    if (!res.ok) { console.warn('[employeeFormPdf] image fetch failed', absUrl, res.status); return null }
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) { console.warn('[employeeFormPdf] not an image response', absUrl, contentType); return null }
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('[employeeFormPdf] image load error', url, e)
    return null
  }
}

export async function generateEmployeeFormPdf(emp: any, company: { name?: string } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 12
  const pageW = doc.internal.pageSize.getWidth()
  const photoW = 24, photoH = 28
  const photoX = pageW - marginX - photoW
  let y = 10

  // ============ HEADER: logo + company name bar + "Employee Details" + photo box ============
  const logoData = await loadImageAsDataUrl(BRAND.logoUrl).catch(() => null)
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', marginX, y, 14, 14) } catch { /* ignore bad image */ }
  }
  const titleX = marginX + (logoData ? 17 : 0)
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(20)
  doc.text(company.name || BRAND.name, titleX, y + 6)
  doc.setFillColor(30, 41, 59)
  doc.roundedRect(titleX, y + 9, photoX - titleX - 4, 6, 1, 1, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255)
  doc.text('EMPLOYEE DETAILS', titleX + 4, y + 13.3)
  doc.setTextColor(0)

  // Photo box, top-right — matches the paper form's "Photo" square
  doc.setDrawColor(0)
  doc.rect(photoX, y, photoW, photoH)
  const photoData = emp.user?.avatar ? await loadImageAsDataUrl(emp.user.avatar).catch(() => null) : null
  if (photoData) {
    try { doc.addImage(photoData, photoX + 0.5, y + 0.5, photoW - 1, photoH - 1) } catch { /* leave box empty */ }
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(160)
    doc.text('Photo', photoX + photoW / 2, y + photoH / 2, { align: 'center' })
    doc.setTextColor(0)
  }

  y += photoH + 2.5

  const section = (title: string | false, rows: any[], opts: any = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: opts.head !== undefined ? opts.head : (title ? [[{ content: title, colSpan: rows[0]?.length || 2 }]] : undefined),
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.3, valign: 'middle' },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: opts.columnStyles || { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      ...opts,
    })
    // @ts-ignore - jspdf-autotable attaches this
    y = (doc as any).lastAutoTable.finalY + 2.5
  }

  const addr = [emp.address, emp.city, emp.state, emp.pincode].filter(Boolean).join(', ')

  section('Personal details', [
    ['Name', emp.user?.name || ''],
    ['Mobile', emp.user?.phone || ''],
    ['Email ID', emp.user?.email || ''],
    ['Date of birth', emp.dateOfBirth ? formatDate(emp.dateOfBirth) : ''],
    ['Current address', addr],
    ['Permanent address', emp.permanentAddress || ''],
    ['Education', emp.education || ''],
    ['Blood group', emp.bloodGroup || ''],
    ['Emergency contact details', [emp.emergencyContact, emp.emergencyPhone].filter(Boolean).join(' — ')],
  ])

  section('Family details', [
    ['Father', emp.fatherName || '', emp.fatherPhone || ''],
    ['Mother', emp.motherName || '', emp.motherPhone || ''],
    ['Spouse', emp.spouseName || '', emp.spousePhone || ''],
    ['Marriage date (if married)', emp.marriageDate ? formatDate(emp.marriageDate) : '', ''],
  ], {
    head: [['', 'Name', 'Number']],
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 45 } },
  })

  section('Personal Documents', [
    ['Aadhar Card', emp.aadharNumber || ''],
    ['Pan card', emp.panNumber || ''],
    ['Driving license', emp.drivingLicense || ''],
  ])

  section('Medical information', [[emp.medicalInfo || '']], {
    columnStyles: { 0: { cellWidth: 'auto' } },
    styles: { fontSize: 8, cellPadding: 1.3, minCellHeight: 6 },
  })

  section('Bank details', [
    ['Bank name', emp.bankName || ''],
    ['Bank Address', emp.bankAddress || ''],
    ['Account no.', emp.accountNumber || ''],
    ['Name on account', emp.accountHolderName || ''],
    ['IFSC', emp.ifscCode || ''],
  ])

  section('For office use only', [
    ['Employee ID', emp.employeeId || '', 'Police verification status', ''],
    ['Date of interview', '', 'Date of Joining', emp.joiningDate ? formatDate(emp.joiningDate) : ''],
    ['Remarks', '', '', ''],
  ], {
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 47 }, 2: { cellWidth: 45, fontStyle: 'bold' }, 3: { cellWidth: 'auto' } },
  })

  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text('This is a system-generated form. For internal HR use only.', marginX, 290)

  // Open in a new tab instead of forcing a download
  doc.output('dataurlnewwindow', { filename: `Employee-Form-${emp.employeeId || emp.user?.name || 'employee'}.pdf` })
}
