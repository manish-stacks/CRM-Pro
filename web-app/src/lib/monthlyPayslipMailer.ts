// src/lib/monthlyPayslipMailer.ts
// Automatically generates and emails salary slip PDFs to active employees.
// Scheduled to run every month on the 2nd at 9:00 AM IST via instrumentation.ts.
import { prisma } from './prisma'
import { BRAND } from './branding'
import { Settings } from './settings'
import { sendMail, wrapEmailHtml } from './mailer'
import { buildPayslipBody, CompanyInfo } from './businessPdf'
import { renderBusinessPdf } from './pdfRenderer'
import { getISTDateParts } from './attendanceDate'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export interface MonthlyPayslipRunResult {
  month: number
  year: number
  monthName: string
  totalEmployees: number
  sent: number
  failed: number
  errors: Array<{ employeeId: string; name: string; error: string }>
}

export async function sendMonthlyPayslips(
  monthParam?: number,
  yearParam?: number,
  targetEmployeeId?: string
): Promise<MonthlyPayslipRunResult> {
  const istNow = getISTDateParts(new Date())

  // Default: previous completed month
  let targetMonth = monthParam
  let targetYear = yearParam

  if (!targetMonth || !targetYear) {
    if (istNow.month === 0) { // Jan -> Dec previous year
      targetMonth = 12
      targetYear = istNow.year - 1
    } else {
      targetMonth = istNow.month
      targetYear = istNow.year
    }
  }

  const monthName = MONTH_NAMES[targetMonth - 1]

  const [
    companyName, companyAddress, companyPhone, companyEmail, companyGst, companyLogoUrl, companySignatureUrl,
    basicPercent, hraPercent, conveyanceAmount, medicalAmount
  ] = await Promise.all([
    Settings.companyName(),
    Settings.companyAddress(),
    Settings.companyPhone(),
    Settings.companyEmail(),
    Settings.companyGst(),
    Settings.companyLogo(),
    Settings.companySignature(),
    Settings.payrollBasicPercent(),
    Settings.payrollHraPercent(),
    Settings.payrollConveyanceAmount(),
    Settings.payrollMedicalAmount(),
  ])

  const company: CompanyInfo = {
    companyName: companyName || BRAND.name,
    companyAddress: companyAddress || undefined,
    companyPhone: companyPhone || undefined,
    companyEmail: companyEmail || undefined,
    companyGst: companyGst || undefined,
    companyLogoUrl: companyLogoUrl || undefined,
    companySignatureUrl: companySignatureUrl || undefined,
  }

  const empWhere: any = { user: { isActive: true } }
  if (targetEmployeeId) empWhere.id = targetEmployeeId

  const employees = await prisma.employee.findMany({
    where: empWhere,
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { name: true } },
    },
  })

  const result: MonthlyPayslipRunResult = {
    month: targetMonth,
    year: targetYear,
    monthName,
    totalEmployees: employees.length,
    sent: 0,
    failed: 0,
    errors: [],
  }

  for (const emp of employees) {
    const userEmail = emp.user.email
    if (!userEmail) {
      result.failed++
      result.errors.push({ employeeId: emp.id, name: emp.user.name, error: 'No email address on user account' })
      continue
    }

    try {
      // Find existing payslip
      let payslip = await prisma.payslip.findUnique({
        where: { employeeId_month_year: { employeeId: emp.id, month: targetMonth, year: targetYear } },
      })

      // If no payslip exists, create a baseline payslip row
      if (!payslip) {
        const monthlySalary = emp.salary || 0
        const basicSalary = Math.round(monthlySalary * (basicPercent / 100))
        const hra = Math.round(basicSalary * (hraPercent / 100))
        const conveyance = Math.min(conveyanceAmount, Math.round(monthlySalary * 0.05))
        const medical = Math.min(medicalAmount, Math.round(monthlySalary * 0.05))
        const specialAllow = Math.max(0, monthlySalary - (basicSalary + hra + conveyance + medical))
        const grossSalary = basicSalary + hra + conveyance + medical + specialAllow

        payslip = await prisma.payslip.create({
          data: {
            employeeId: emp.id,
            month: targetMonth,
            year: targetYear,
            basicSalary,
            hra,
            conveyance,
            medical,
            specialAllow,
            grossSalary,
            netSalary: grossSalary,
            workingDays: 26,
            presentDays: 26,
            lopDays: 0,
            status: 'PENDING',
            notes: 'Generated automatically for monthly salary slip email',
          },
        })
      }

      const paidDays = Math.max(0, Math.round((payslip.workingDays || 0) - (payslip.lopDays || 0)))
      const bodyHtml = buildPayslipBody({
        month: monthName,
        year: targetYear,
        paidDays,
        payDate: new Date(payslip.generatedAt || payslip.createdAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }),
        employee: {
          name: emp.user.name,
          employeeId: emp.employeeId,
          position: emp.position || '—',
          department: emp.department?.name || '—',
        },
        bank: {
          bankName: emp.bankName || undefined,
          accountNumber: emp.accountNumber || undefined,
        },
        earnings: {
          basic: payslip.basicSalary,
          hra: payslip.hra,
          conveyance: payslip.conveyance,
          medical: payslip.medical,
          specialAllow: payslip.specialAllow,
          bonus: payslip.otherEarnings,
        },
        deductions: {
          advance: payslip.otherDeduct,
          lop: Math.max(0, (payslip.basicSalary + payslip.hra + payslip.conveyance + payslip.medical + payslip.specialAllow) - payslip.grossSalary),
          lopDays: payslip.lopDays || 0,
          esi: payslip.esi,
          pf: payslip.pf,
          professionTax: payslip.professionTax,
          tds: payslip.tds,
        },
        grossEarnings: payslip.basicSalary + payslip.hra + payslip.conveyance + payslip.medical + payslip.specialAllow + payslip.otherEarnings,
        totalDeduction: payslip.totalDeduct + payslip.otherDeduct + Math.max(0, (payslip.basicSalary + payslip.hra + payslip.conveyance + payslip.medical + payslip.specialAllow) - payslip.grossSalary),
        netSalary: payslip.netSalary,
        company,
      })

      // Generate PDF attachment
      let pdfBuffer: Buffer | null = null
      try {
        pdfBuffer = await renderBusinessPdf(bodyHtml, `Payslip - ${monthName} ${targetYear}`)
      } catch (pdfErr) {
        console.warn(`[monthlyPayslipMailer] PDF rendering failed for ${emp.user.name}, falling back to HTML email:`, pdfErr)
      }

      const emailSubject = `Salary Slip for ${monthName} ${targetYear} - ${company.companyName}`
      const emailContent = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;">
          <h2 style="color: #1e3a8a; margin-top: 0;">Salary Slip for ${monthName} ${targetYear}</h2>
          <p>Dear <b>${emp.user.name}</b>,</p>
          <p>Please find attached your official salary slip for <b>${monthName} ${targetYear}</b>.</p>

          <table style="width: 100%; max-width: 500px; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">Employee ID</td>
              <td style="padding: 10px 14px; font-weight: 600; text-align: right;">${emp.employeeId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">Department / Role</td>
              <td style="padding: 10px 14px; font-weight: 600; text-align: right;">${emp.department?.name || '—'} · ${emp.position || '—'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">Working / Paid Days</td>
              <td style="padding: 10px 14px; font-weight: 600; text-align: right;">${paidDays} of ${payslip.workingDays || 26} days</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">Gross Payable</td>
              <td style="padding: 10px 14px; font-weight: 600; text-align: right;">₹${(payslip.grossSalary || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; color: #64748b; font-size: 13px;">Total Deductions</td>
              <td style="padding: 10px 14px; color: #dc2626; font-weight: 600; text-align: right;">₹${((payslip.totalDeduct || 0) + (payslip.otherDeduct || 0)).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <td style="padding: 12px 14px; font-weight: bold; font-size: 15px;">Net Salary (Transfer)</td>
              <td style="padding: 12px 14px; font-weight: bold; font-size: 16px; text-align: right;">₹${(payslip.netSalary || 0).toLocaleString('en-IN')}</td>
            </tr>
          </table>

          <p style="font-size: 13px; color: #64748b;">
            ${pdfBuffer ? 'Your detailed payslip is attached as a PDF to this email.' : 'You can view and download your PDF payslip from your employee dashboard.'}
          </p>

          <p style="margin-top: 24px; font-size: 13px; color: #94a3b8;">
            Best regards,<br/>
            <b>${company.companyName} Payroll Team</b>
          </p>
        </div>
      `

      const attachments: any[] = []
      if (pdfBuffer) {
        attachments.push({
          filename: `Payslip_${monthName}_${targetYear}.pdf`,
          content: pdfBuffer,
        })
      }

      const mailRes = await sendMail({
        to: userEmail,
        subject: emailSubject,
        html: wrapEmailHtml(`Salary Slip - ${monthName} ${targetYear}`, emailContent),
        attachments,
        referenceType: 'PAYSLIP',
        referenceId: payslip.id,
      })

      if (mailRes.success) {
        result.sent++
      } else {
        result.failed++
        result.errors.push({ employeeId: emp.id, name: emp.user.name, error: mailRes.error || 'Failed to send mail' })
      }
    } catch (empErr: any) {
      console.error(`[monthlyPayslipMailer] Error processing employee ${emp.user.name}:`, empErr)
      result.failed++
      result.errors.push({ employeeId: emp.id, name: emp.user.name, error: empErr.message || 'Unknown error' })
    }
  }

  return result
}
