// src/lib/whatsapp.ts
// WhatsApp API wrapper using BUZWAP/waapi.hoverbusinessservices.com endpoint
// Docs endpoint format:
//   http://waapi.hoverbusinessservices.com/api/sendmsgutil.php
//     ?user=X&pass=Y&sender=Z&phone=N&text=TEMPLATE_NAME
//     &priority=wa&stype=normal&Params=p1,p2,p3
import { prisma } from './prisma'

// ============ Approved Template Registry ============
// These template names MUST be created + approved on BUZWAP dashboard.
// Parameter ORDER matters — matches template body {{1}}, {{2}}, ...
export const WHATSAPP_TEMPLATES = {
  hbs_client_welcome:            ['clientName', 'companyName', 'loginEmail', 'loginPassword', 'portalUrl'] as const,
  hbs_employee_welcome:          ['employeeName', 'companyName', 'loginEmail', 'loginPassword', 'loginUrl'] as const,
  hbs_lead_meeting_scheduled:    ['clientName', 'meetingDate', 'meetingTime', 'marketingPersonName', 'marketingPhone'] as const,
  hbs_proposal_sent:             ['clientName', 'proposalNumber', 'amount', 'viewUrl'] as const,
  hbs_invoice_generated:         ['clientName', 'invoiceNumber', 'amount', 'dueDate', 'payUrl'] as const,
  hbs_payment_received:          ['clientName', 'amount', 'invoiceNumber', 'paymentMethod'] as const,
  hbs_service_expiry_reminder:   ['clientName', 'serviceName', 'expiryDate', 'daysLeft'] as const,
  hbs_service_renewed:           ['clientName', 'serviceName', 'newExpiryDate'] as const,
  hbs_birthday_wish:             ['name'] as const,
  hbs_work_anniversary:          ['name', 'years'] as const,
  hbs_leave_approved:            ['employeeName', 'startDate', 'endDate', 'days'] as const,
  hbs_leave_rejected:            ['employeeName', 'startDate', 'endDate', 'reason'] as const,
  hbs_ticket_created:            ['ticketNumber', 'subject', 'departmentName'] as const,
  hbs_ticket_resolved:           ['ticketNumber', 'subject'] as const,
  hbs_client_report_uploaded:    ['clientName', 'reportTitle', 'downloadUrl'] as const,
  hbs_password_reset:            ['name', 'resetCode'] as const,
} as const

export type WhatsappTemplate = keyof typeof WHATSAPP_TEMPLATES

export interface SendWhatsappOptions {
  toPhone: string                        // "+919999999999" or "919999999999" - digits kept only
  template: WhatsappTemplate
  params: Record<string, string | number>
  referenceType?: string                 // LEAD, CLIENT, PROPOSAL, INVOICE etc
  referenceId?: string
}

export interface SendWhatsappResult {
  success: boolean
  response?: string
  error?: string
  logId?: string
}

/**
 * Normalize phone number: keep digits only, ensure country code
 */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits          // Bare Indian number
  if (digits.startsWith('0')) digits = '91' + digits.slice(1)
  return digits
}

/**
 * Build parameter string from a param object, in the template's declared order.
 */
function buildParams(template: WhatsappTemplate, params: Record<string, string | number>): string {
  const order = WHATSAPP_TEMPLATES[template] as readonly string[]
  return order.map(k => encodeURIComponent(String(params[k] ?? ''))).join(',')
}

export async function sendWhatsapp(opts: SendWhatsappOptions): Promise<SendWhatsappResult> {
  const toPhone = normalizePhone(opts.toPhone)
  const paramString = buildParams(opts.template, opts.params)

  const log = await prisma.whatsappLog.create({
    data: {
      toPhone,
      templateName: opts.template,
      params: JSON.stringify(opts.params),
      status: 'PENDING',
      referenceType: opts.referenceType,
      referenceId: opts.referenceId,
    },
  })

  try {
    if (!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_USER) {
      throw new Error('WhatsApp API not configured. Set WHATSAPP_* env vars.')
    }

    const url = `${process.env.WHATSAPP_API_URL}?user=${encodeURIComponent(process.env.WHATSAPP_USER)}&pass=${encodeURIComponent(process.env.WHATSAPP_PASS || '')}&sender=${encodeURIComponent(process.env.WHATSAPP_SENDER || 'BUZWAP')}&phone=${toPhone}&text=${encodeURIComponent(opts.template)}&priority=wa&stype=normal&Params=${paramString}`

    const res = await fetch(url, { method: 'GET' })
    const text = await res.text()

    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: {
        status: res.ok ? 'SENT' : 'FAILED',
        response: text,
        sentAt: res.ok ? new Date() : null,
        errorMessage: res.ok ? null : `HTTP ${res.status}`,
      },
    })

    return {
      success: res.ok,
      response: text,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      logId: log.id,
    }
  } catch (e: any) {
    await prisma.whatsappLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMessage: e?.message || String(e) },
    })
    return { success: false, error: e?.message || String(e), logId: log.id }
  }
}