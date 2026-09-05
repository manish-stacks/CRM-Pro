// src/lib/employeeFormPdf.ts
// Admin-only: generates a printable "Employee Information Form" PDF with
// every profile field on record — used from the employee detail page so
// Admin/HR can download/print a hard copy for filing or verification.
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from './utils'

export function generateEmployeeFormPdf(emp: any, company: { name?: string } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 14
  let y = 16

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(company.name || 'Employee Information Form', marginX, y)
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Employee ID: ${emp.employeeId || '-'}  •  Generated: ${formatDate(new Date().toISOString())}`, marginX, y)
  doc.setTextColor(0)
  y += 6

  const section = (title: string, rows: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [[title, '']],
      body: rows.map(([k, v]) => [k, v || '-']),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    })
    // @ts-ignore - jspdf-autotable attaches this
    y = (doc as any).lastAutoTable.finalY + 6
  }

  section('Personal Details', [
    ['Full Name', emp.user?.name],
    ['Date of Birth', emp.dateOfBirth ? formatDate(emp.dateOfBirth) : ''],
    ['Gender', emp.gender],
    ['Blood Group', emp.bloodGroup],
    ['Marital Status', emp.maritalStatus],
    ["Father's Name", emp.fatherName],
    ["Mother's Name", emp.motherName],
  ])

  section('Contact Details', [
    ['Phone', emp.user?.phone],
    ['Alternate Phone', emp.user?.altPhone],
    ['Email', emp.user?.email],
    ['Address', emp.address],
    ['City / State', [emp.city, emp.state].filter(Boolean).join(', ')],
    ['Pincode', emp.pincode],
    ['Emergency Contact', emp.emergencyContact],
    ['Emergency Phone', emp.emergencyPhone],
  ])

  section('Employment Details', [
    ['Department', emp.department?.name],
    ['Position', emp.position],
    ['Role', emp.user?.role],
    ['Work Mode', emp.workMode],
    ['Joining Date', emp.joiningDate ? formatDate(emp.joiningDate) : ''],
    ['Status', emp.user?.isActive ? 'Active' : 'Inactive'],
  ])

  section('Identity & Bank Details', [
    ['PAN Number', emp.panNumber],
    ['Aadhar Number', emp.aadharNumber],
    ['ID Proof Type', emp.idProofType],
    ['ID Proof Number', emp.idProofNumber],
    ['Bank Name', emp.bankName],
    ['Account Holder Name', emp.accountHolderName],
    ['Account Number', emp.accountNumber],
    ['IFSC Code', emp.ifscCode],
  ])

  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text('This is a system-generated form. For internal HR use only.', marginX, 290)

  doc.save(`Employee-Form-${emp.employeeId || emp.user?.name || 'employee'}.pdf`)
}
