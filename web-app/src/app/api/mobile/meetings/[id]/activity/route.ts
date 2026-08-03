// src/app/api/mobile/meetings/[id]/activity/route.ts
// Log a call/remark/note against a meeting lead — same LeadActivity model the
// web /leads/[id] timeline uses.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireMobileEmployee, ok, fail } from '@/lib/mobileAuth'
import { logFromRequest } from '@/lib/audit'

const VALID_TYPES = ['CALL', 'REMARK', 'NOTE', 'FOLLOWUP_SCHEDULED']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await requireMobileEmployee(req)
  if (res instanceof Response) return res
  const { session } = res as any

  let body: any = {}
  try { body = await req.json() } catch { return fail('Invalid body') }
  const { type = 'REMARK', title, description } = body

  if (!VALID_TYPES.includes(type)) return fail('Invalid activity type')
  if (!title?.trim()) return fail('Title required')

  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return fail('Meeting not found', 404)

  const isOwner = [lead.assignedToId, lead.meetingAssignedToId, lead.createdById].includes(session.userId)
  if (!isOwner) return fail('Forbidden', 403)

  const activity = await prisma.leadActivity.create({
    data: {
      leadId: id,
      type,
      title: title.trim(),
      description: description || null,
      createdById: session.userId,
    },
  })

  await logFromRequest(req, {
    userId: session.userId, action: 'CREATE', entityType: 'LeadActivity', entityId: activity.id,
    metadata: { via: 'mobile', leadId: id, type },
  })

  return ok({ id: activity.id, title: activity.title, createdAt: activity.createdAt })
}