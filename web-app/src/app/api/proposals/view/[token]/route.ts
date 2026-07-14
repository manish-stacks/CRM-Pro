// src/app/api/proposals/view/[token]/route.ts
// FIXES:
//   1. Old code referenced lead.name, lead.company, client.contactName — these fields
//      do not exist in the Prisma schema. Now uses lead.clientName, lead.companyName,
//      client.clientName as per schema.
//   2. Next.js 16: params is now Promise<{ ... }> and must be awaited.
//   3. Client auto-creation on acceptance now uses proper generateClientCode() +
//      required fields for the v2 schema (phone, portalPasswordSet=false).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api'
import { generateClientCode } from '@/lib/idgen'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  try {
    const proposal = await prisma.proposal.findFirst({
      where: { shareToken: token },
      include: {
        lead: {
          select: {
            id: true,
            clientName: true,
            companyName: true,
            clientPhone: true,
            clientEmail: true,
          },
        },
        client: {
          select: {
            id: true,
            clientName: true,
            companyName: true,
            phone: true,
            email: true,
          },
        },
        items: { orderBy: { order: 'asc' } },
        createdBy: { select: { name: true, email: true } },
      },
    })

    if (!proposal) return errorResponse('Proposal not found', 404)

    // Auto-mark VIEWED when a SENT proposal is opened
    if (proposal.status === 'SENT') {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: 'VIEWED', viewedAt: new Date() },
      })
    }

    // Company info from settings
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['company_name', 'company_email', 'company_phone', 'company_address', 'company_gst'] } },
    })
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => { settingsMap[s.key] = s.value })

    return successResponse({
      ...proposal,
      status: proposal.status === 'SENT' ? 'VIEWED' : proposal.status,
      company: {
        name:    settingsMap.company_name    || 'Your Company',
        email:   settingsMap.company_email   || '',
        phone:   settingsMap.company_phone   || '',
        address: settingsMap.company_address || '',
        gst:     settingsMap.company_gst     || '',
      },
    })
  } catch (error) {
    console.error('Proposal view error:', error)
    return errorResponse('Failed to load proposal')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await req.json()
  const { action } = body

  if (!['accept', 'reject'].includes(action)) {
    return errorResponse('Invalid action')
  }

  try {
    const proposal = await prisma.proposal.findFirst({
      where: { shareToken: token },
      include: { lead: true },
    })

    if (!proposal) return errorResponse('Proposal not found', 404)
    if (!['SENT', 'VIEWED'].includes(proposal.status)) {
      return errorResponse('Proposal is no longer actionable')
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'REJECTED'

    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: newStatus, respondedAt: new Date() },
    })

    // Accept -> auto-create Client from Lead
    if (action === 'accept' && proposal.leadId && proposal.lead) {
      const lead = proposal.lead

      // Only create client if one doesn't already exist for this lead
      const existingClient = await prisma.client.findUnique({ where: { leadId: lead.id } })
      if (!existingClient) {
        await prisma.client.create({
          data: {
            clientCode:  await generateClientCode(),
            companyName: lead.companyName || lead.clientName,
            clientName:  lead.clientName,
            phone:       lead.clientPhone,
            email:       lead.clientEmail,
            address:     lead.address,
            state:       lead.state,
            city:        lead.city,
            leadId:      lead.id,
            createdById: proposal.createdById,
            marketingPersonId: lead.meetingAssignedToId || null,
            telecallerId: lead.assignedToId || null,
            status:      'ACTIVE',
            onboardingDate: new Date(),
            portalPasswordSet: false,
          },
        })
      }

      await prisma.lead.update({
        where: { id: proposal.leadId },
        data: { status: 'CONVERTED', convertedAt: new Date() },
      })
    }

    if (action === 'reject' && proposal.leadId) {
      await prisma.lead.update({
        where: { id: proposal.leadId },
        data: { status: 'FOLLOW_UP' },
      })
    }

    return successResponse({ status: newStatus })
  } catch (error) {
    console.error('Proposal action error:', error)
    return errorResponse('Failed to update proposal')
  }
}
