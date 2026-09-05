// src/app/api/seo-reports/route.ts
// Dynamic SEO + GMB monthly reports. Scoped: MANAGER+ sees all, an employee sees
// only the clients/services they are assigned to via ProjectAssignment.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestSession, hasMinRole } from '@/lib/auth'
import { successResponse, successStatusResponse, errorResponse, unauthorizedResponse, getPaginationParams } from '@/lib/api'
import { logFromRequest } from '@/lib/audit'

/** Client service ids the user may report on (null = unrestricted). */
export async function scopedServiceIds(userId: string, role: string): Promise<string[] | null> {
  if (hasMinRole(role, 'MANAGER')) return null
  const rows = await prisma.projectAssignment.findMany({
    where: { isActive: true, OR: [{ managerId: userId }, { memberId: userId }] },
    select: { clientServiceId: true },
  })
  return Array.from(new Set(rows.map(r => r.clientServiceId)))
}

async function generateReportNumber(): Promise<string> {
  const count = await prisma.seoReport.count()
  return `SEO-${String(count + 1).padStart(6, '0')}`
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const sp = req.nextUrl.searchParams
  const { skip, limit } = getPaginationParams(sp)
  const status = sp.get('status') || ''
  const clientId = sp.get('clientId') || ''
  const search = sp.get('search') || ''

  const allowed = await scopedServiceIds(session.userId, session.role)

  const where: any = {}
  if (status) where.status = status
  if (clientId) where.clientId = clientId
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { reportNumber: { contains: search } },
      { reportMonth: { contains: search } },
      { client: { is: { companyName: { contains: search } } } },
    ]
  }
  if (allowed) {
    where.AND = [
      ...(where.AND || []),
      { OR: [{ clientServiceId: { in: allowed } }, { createdById: session.userId }] },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.seoReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, reportNumber: true, title: true, reportMonth: true, reportDate: true,
        status: true, pdfUrl: true, submittedAt: true, createdAt: true,
        client: { select: { id: true, companyName: true, clientName: true, clientCode: true, image: true } },
        clientService: { select: { id: true, serviceName: true } },
        createdBy: { select: { name: true, avatar: true } },
      },
    }),
    prisma.seoReport.count({ where }),
  ])

  return successResponse(rows, total)
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  const body = await req.json()
  const { clientId, clientServiceId, projectAssignmentId, title, reportMonth, reportDate, data } = body

  if (!clientId) return errorResponse('Client is required')
  if (!reportMonth) return errorResponse('Reporting period is required')

  const allowed = await scopedServiceIds(session.userId, session.role)
  if (allowed && clientServiceId && !allowed.includes(clientServiceId)) {
    return errorResponse('You are not assigned to this project', 403)
  }
  if (allowed && !clientServiceId) {
    return errorResponse('Select the project/service you are assigned to', 403)
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { companyName: true } })
  if (!client) return errorResponse('Client not found', 404)

  const report = await prisma.seoReport.create({
    data: {
      reportNumber: await generateReportNumber(),
      clientId,
      clientServiceId: clientServiceId || null,
      projectAssignmentId: projectAssignmentId || null,
      title: title || `${client.companyName} SEO + GMB Monthly Report ${reportMonth}`,
      reportMonth,
      reportDate: reportDate ? new Date(reportDate) : new Date(),
      data: data ? JSON.stringify(data) : null,
      createdById: session.userId,
    },
  })

  await logFromRequest(req, {
    userId: session.userId,
    action: 'CREATE',
    entityType: 'SeoReport',
    entityId: report.id,
    metadata: { clientId, reportMonth },
  })

  return successStatusResponse(report, 201)
}
