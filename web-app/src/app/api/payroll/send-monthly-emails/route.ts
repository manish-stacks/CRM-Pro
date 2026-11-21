// src/app/api/payroll/send-monthly-emails/route.ts
// Admin-triggerable endpoint to email monthly payslips (with PDF attachments) to employees.
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendMonthlyPayslips } from '@/lib/monthlyPayslipMailer'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'ADMIN')
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  try {
    let body: any = {}
    try { body = await req.json() } catch { }

    const month = body?.month ? Number(body.month) : undefined
    const year = body?.year ? Number(body.year) : undefined
    const employeeId = body?.employeeId ? String(body.employeeId) : undefined

    const result = await sendMonthlyPayslips(month, year, employeeId)

    await logFromRequest(req, {
      userId: session.userId,
      action: 'SEND_PAYSLIP_EMAILS',
      entityType: 'Payroll',
      metadata: { month: result.month, year: result.year, sent: result.sent, failed: result.failed },
    })

    return successResponse(result)
  } catch (error: any) {
    console.error('Send monthly payslips error:', error)
    return errorResponse(error?.message || 'Failed to send monthly payslips', 500)
  }
}
