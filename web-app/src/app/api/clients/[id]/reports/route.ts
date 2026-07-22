// src/app/api/clients/[id]/reports/route.ts
// Client reports — text + Cloudinary uploaded files (image, PDF, mixed)
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'
import { sendWhatsapp } from '@/lib/whatsapp'
import { Notifications } from '@/lib/notify'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  // Confirm access
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { telecallerId: true, marketingPersonId: true, id: true },
  })
  if (!client) return notFoundResponse('Client')

  if (!hasMinRole(session.role, 'MANAGER')) {
    // Non-admin: must be linked to this client (telecaller/marketing/team member)
    const isLinked =
      client.telecallerId === session.userId ||
      client.marketingPersonId === session.userId
    if (!isLinked) {
      // Also allow team members via project assignment
      const isMember = await prisma.projectAssignment.findFirst({
        where: {
          isActive: true,
          OR: [{ managerId: session.userId }, { memberId: session.userId }],
          clientService: { clientId },
        },
      })
      if (!isMember) return errorResponse('Forbidden', 403)
    }
  }

  const reports = await prisma.clientReport.findMany({
    where: { clientId },
    include: {
      uploadedBy: { select: { name: true, avatar: true, role: true } },
      clientService: { select: { serviceName: true } },
    },
    orderBy: { reportDate: 'desc' },
  })
  return successResponse(reports)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const body = await req.json()
  const {
    title, description, reportType = 'TEXT',
    fileUrl, fileType, fileSize,
    reportPeriod, reportDate,
    content, clientServiceId,
    notifyClient = false,
  } = body

  if (!title) return errorResponse('Title required')

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) return notFoundResponse('Client')

  const report = await prisma.clientReport.create({
    data: {
      clientId,
      clientServiceId: clientServiceId || null,
      title,
      description: description || null,
      reportType,
      fileUrl: fileUrl || null,
      fileType: fileType || null,
      fileSize: fileSize ? Number(fileSize) : null,
      reportPeriod: reportPeriod || null,
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      content: content || null,
      uploadedById: session.userId,
    },
    include: {
      uploadedBy: { select: { name: true, avatar: true } },
      clientService: { select: { serviceName: true } },
    },
  })

  // Optional WhatsApp notification to client
  if (notifyClient && client.phone) {
    sendWhatsapp({
      toPhone: client.phone,
      template: 'hbs_client_report_uploaded',
      params: {
        clientName: client.clientName,
        reportTitle: title,
        reportPeriod: reportPeriod || new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
      },
      referenceType: 'CLIENT_REPORT',
      referenceId: report.id,
    }).catch(() => {})
  }

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'ClientReport',
    entityId: report.id,
    metadata: { clientId, title, reportType },
  })

  // Notify the client's assigned staff (reporting/marketing/telecaller), minus the uploader
  const staffRecipients = new Set<string>()
  ;[client.reportingPersonId, client.marketingPersonId, client.telecallerId].forEach(x => x && staffRecipients.add(x))
  staffRecipients.delete(session.userId)
  if (staffRecipients.size) {
    Notifications.reportUploaded(Array.from(staffRecipients), client.clientName, title, clientId).catch(() => {})
  }

  return successStatusResponse(report, 201)
}
