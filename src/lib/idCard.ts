// src/lib/idCard.ts
// Generate a printable employee ID card (CR80 portrait ~54x86mm) as a PDF.
import jsPDF from 'jspdf'

interface IdCardEmployee {
  employeeId: string
  name: string
  department?: string | null
  position?: string | null
  bloodGroup?: string | null
  phone?: string | null
  joiningDate?: string | null
  avatarInitials?: string
}
interface Company {
  name?: string
  phone?: string
  email?: string
}

const PRIMARY = [37, 99, 235] as const   // indigo/blue
const DARK = [17, 24, 39] as const
const GRAY = [107, 114, 128] as const

export function generateIdCard(emp: IdCardEmployee, company: Company = {}) {
  const W = 54, H = 86
  const doc = new jsPDF({ unit: 'mm', format: [W, H] })

  // Card border
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(1, 1, W - 2, H - 2, 3, 3, 'S')

  // Header band
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2])
  doc.roundedRect(1, 1, W - 2, 20, 3, 3, 'F')
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2])
  doc.rect(1, 12, W - 2, 9, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text((company.name || 'Hover Business Services').toUpperCase(), W / 2, 9, { align: 'center', maxWidth: W - 8 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text('EMPLOYEE IDENTITY CARD', W / 2, 15, { align: 'center' })

  // Avatar circle with initials
  const cx = W / 2, cy = 33
  doc.setFillColor(238, 242, 255)
  doc.circle(cx, cy, 10, 'F')
  doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2])
  doc.setLineWidth(0.5)
  doc.circle(cx, cy, 10, 'S')
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(emp.avatarInitials || emp.name.slice(0, 2).toUpperCase(), cx, cy + 2, { align: 'center' })

  // Name + ID
  doc.setTextColor(DARK[0], DARK[1], DARK[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(emp.name, W / 2, 49, { align: 'center', maxWidth: W - 8 })
  doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2])
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(emp.employeeId, W / 2, 54, { align: 'center' })

  // Details
  const rows: [string, string][] = [
    ['Designation', emp.position || '—'],
    ['Department', emp.department || '—'],
    ['Blood Group', emp.bloodGroup || '—'],
    ['Phone', emp.phone || '—'],
    ['Joined', emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '—'],
  ]
  let y = 60
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2])
    doc.text(label.toUpperCase(), 6, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(DARK[0], DARK[1], DARK[2])
    doc.text(String(value), W - 6, y, { align: 'right', maxWidth: 30 })
    y += 4.6
  })

  // Footer
  doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2])
  doc.rect(1, H - 7, W - 2, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.text(
    `${company.phone || ''}${company.phone && company.email ? '  ·  ' : ''}${company.email || ''}`.trim() || 'If found, please return to the company',
    W / 2, H - 3, { align: 'center' }
  )

  doc.save(`ID-Card-${emp.employeeId}.pdf`)
}
