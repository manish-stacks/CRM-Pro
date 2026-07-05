// src/app/api/payroll/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession } from '@/lib/auth'
import { generatePayslipHTML } from '@/lib/pdf'
import { Settings } from '@/lib/settings'

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

    const [companyName, companyAddress, companyLogoUrl] = await Promise.all([
      Settings.companyName(),
      Settings.companyAddress(),
      Settings.companyLogo(),
    ])

    const html = generatePayslipHTML({
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
      companyName: companyName || 'Company',
      companyAddress: companyAddress || undefined,
      companyLogoUrl: companyLogoUrl || undefined,
    })

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="payslip-${payslip.id}.html"`,
      },
    })
  } catch (error) {
    console.error('Payslip PDF error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}