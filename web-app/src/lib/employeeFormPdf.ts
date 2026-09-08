// src/lib/employeeFormPdf.ts
// Admin-only: generates a printable "Employee Details" PDF that mirrors the
// company's paper intake form (logo header, photo box, boxed sections for
// Personal/Family/Documents/Bank/Medical/Office-use details) — used from the
// employee detail page so Admin/HR can download/print a hard copy.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './utils'
import { BRAND } from './branding'

// ---- Palette (fixed — PDF can't read the app's live CSS accent color) ----
const INK: [number, number, number] = [15, 23, 42]        // slate-900, header band
const ACCENT: [number, number, number] = [37, 99, 235]     // blue-600, section bars
const ACCENT_SOFT: [number, number, number] = [239, 246, 255] // blue-50, zebra stripe
const MUTED: [number, number, number] = [100, 116, 139]    // slate-500

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const isRelative = url.startsWith('/')
    const absUrl = typeof window !== 'undefined' && isRelative ? window.location.origin + url : url

    // Cross-origin URLs (external logo host, R2 avatar bucket, etc.) get
    // silently blocked by CORS on a direct browser fetch(), which was
    // making the logo/photo quietly disappear from the PDF. Route those
    // through /api/proxy-image, which fetches server-side (no CORS) and
    // hands back a data URL. Same-origin/relative URLs skip the proxy.
    if (!isRelative && typeof window !== 'undefined') {
      try {
        const proxied = new URL(absUrl).origin !== window.location.origin
        if (proxied) {
          const pres = await fetch(`/api/proxy-image?url=${encodeURIComponent(absUrl)}`)
          if (pres.ok) {
            const json = await pres.json()
            if (json?.data?.dataUrl) return json.data.dataUrl
          }
          console.warn('[employeeFormPdf] proxy image fetch failed', absUrl)
          return null
        }
      } catch { /* fall through to direct fetch below */ }
    }

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

export async function generateEmployeeFormPdf(emp: any, company: { name?: string } = {}, targetWindow?: Window | null) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 12
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  // ============ HEADER (stacked: logo → name → dark title bar) ============
  const photoW = 24, photoH = 28
  const photoX = pageW - marginX - photoW
  let y = 10

  const logoData = await loadImageAsDataUrl(BRAND.logoUrl).catch(() => null)
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', marginX, y, 14, 14) } catch { /* ignore bad image */ }
  }
  y += logoData ? 17 : 2

  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(20)
  doc.text(company.name || BRAND.name, marginX, y)
  y += 4

  doc.setFillColor(...INK)
  doc.roundedRect(marginX, y, photoX - marginX - 4, 7, 1.2, 1.2, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255, 255, 255)
  doc.text('EMPLOYEE DETAILS', marginX + 4, y + 4.8)
  doc.setTextColor(0)

  // Photo box, top-right — matches the paper form's "Photo" square
  const photoY = 10
  doc.setDrawColor(0)
  doc.rect(photoX, photoY, photoW, photoH)
  const photoData = emp.user?.avatar ? await loadImageAsDataUrl(emp.user.avatar).catch(() => null) : null
  if (photoData) {
    try { doc.addImage(photoData, photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1) } catch { /* leave box empty */ }
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text('Photo', photoX + photoW / 2, photoY + photoH / 2, { align: 'center' })
    doc.setTextColor(0)
  }

  y = Math.max(y + 7, photoY + photoH) + 6

  // ============ SECTIONS ============
  const section = (title: string | false, rows: any[], opts: any = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: opts.head !== undefined ? opts.head : (title ? [[{ content: title, colSpan: rows[0]?.length || 2 }]] : undefined),
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, valign: 'middle', lineColor: [226, 232, 240], lineWidth: 0.15 },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: ACCENT_SOFT },
      columnStyles: opts.columnStyles || { 0: { cellWidth: 52, fontStyle: 'bold', textColor: [51, 65, 85] }, 1: { cellWidth: 'auto' } },
      ...opts,
    })
    // @ts-ignore - jspdf-autotable attaches this
    y = (doc as any).lastAutoTable.finalY + 4
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
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold', textColor: [51, 65, 85] }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 45 } },
  })

  section('Personal documents', [
    ['Aadhar Card', emp.aadharNumber || ''],
    ['Pan card', emp.panNumber || ''],
    ['Driving license', emp.drivingLicense || ''],
  ])

  section('Bank details', [
    ['Bank name', emp.bankName || ''],
    ['Bank Address', emp.bankAddress || ''],
    ['Account no.', emp.accountNumber || ''],
    ['Name on account', emp.accountHolderName || ''],
    ['IFSC', emp.ifscCode || ''],
  ])

  section('Medical information', [[emp.medicalInfo || '']], {
    columnStyles: { 0: { cellWidth: 'auto' } },
    styles: { fontSize: 8, cellPadding: 1.6, minCellHeight: 6 },
  })

  section('For office use only', [
    ['Employee ID', emp.employeeId || '', 'Police verification status', ''],
    ['Date of interview', '', 'Date of Joining', emp.joiningDate ? formatDate(emp.joiningDate) : ''],
    ['Remarks', '', '', ''],
  ], {
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold', textColor: [51, 65, 85] }, 1: { cellWidth: 47 }, 2: { cellWidth: 45, fontStyle: 'bold', textColor: [51, 65, 85] }, 3: { cellWidth: 'auto' } },
  })

  // ============ FOOTER ============
  doc.setDrawColor(226, 232, 240)
  doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14)
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED)
  doc.text('This is a system-generated form. For internal HR use only.', marginX, pageH - 9)
  doc.text(`Generated ${formatDate(new Date().toISOString())}`, pageW - marginX, pageH - 9, { align: 'right' })

  // Navigate the tab that was opened synchronously on click (see
  // employees/page.tsx) instead of opening a new one now — by this point
  // we're several `await`s past the click, so a fresh window.open() here
  // gets treated as an unrequested popup.
  const blobUrl = doc.output('bloburl') as unknown as string
  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = blobUrl
  } else {
    window.open(blobUrl, '_blank')
  }
}