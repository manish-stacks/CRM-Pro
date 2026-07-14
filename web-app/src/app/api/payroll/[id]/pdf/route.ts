// src/app/api/payroll/[id]/pdf/route.ts
// Real server-rendered PDF (Puppeteer) with the company letterhead
// header/footer repeating on every page — same pattern as the letters
// module. Replaces the old approach of returning raw HTML.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { Settings } from '@/lib/settings'
import { buildPayslipBody, CompanyInfo } from '@/lib/businessPdf'
import { renderBusinessPdf } from '@/lib/pdfRenderer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequestSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id: id },
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
            department: { select: { name: true } },
          },
        },
      },
    })

    if (!payslip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

    const [companyName, companyAddress, companyPhone, companyEmail] = await Promise.all([
      Settings.companyName(),
      Settings.companyAddress(),
      Settings.companyPhone(),
      Settings.companyEmail(),
    ])

    const company: CompanyInfo = {
      companyName: companyName || 'Hover Business Services LLP',
      companyAddress: companyAddress || undefined,
      companyPhone: companyPhone || undefined,
      companyEmail: companyEmail || undefined,
    }

    const bodyHtml = buildPayslipBody({
      month: MONTH_NAMES[payslip.month - 1] || String(payslip.month),
      year: payslip.year,
      paidDays: Math.round((payslip.workingDays || 0) - (payslip.lopDays || 0)),
      payDate: new Date(payslip.generatedAt || payslip.createdAt).toLocaleDateString('en-GB'),
      employee: {
        name: payslip.employee.user.name,
        employeeId: payslip.employee.employeeId,
        position: payslip.employee.position || '—',
        department: payslip.employee.department?.name || '—',
      },
      bank: {
        bankName: payslip.employee.bankName || undefined,
        accountNumber: payslip.employee.accountNumber || undefined,
      },
      earnings: {
        basic: payslip.basicSalary,
        hra: payslip.hra,
        conveyance: payslip.conveyance,
        medical: payslip.medical,
        specialAllow: payslip.specialAllow + payslip.otherEarnings,
      },
      deductions: {
        advance: payslip.otherDeduct,
        esi: payslip.esi,
        pf: payslip.pf,
        professionTax: payslip.professionTax,
        tds: payslip.tds,
      },
      grossEarnings: payslip.grossSalary + payslip.otherEarnings,
      totalDeduction: payslip.totalDeduct + payslip.otherDeduct,
      netSalary: payslip.netSalary,
      company,
    })

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await renderBusinessPdf(bodyHtml, `Payslip ${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`)
    } catch (err) {
      console.error('Payslip PDF render failed:', err)
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }

    const safeName = (payslip.employee.user.name || 'employee').replace(/[^a-zA-Z0-9]+/g, '-')
    const fileName = `Payslip-${safeName}-${payslip.month}-${payslip.year}.pdf`

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Payslip PDF error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
