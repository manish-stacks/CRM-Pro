import { prisma } from '@/lib/prisma'

// When a meeting is cancelled, any ClientVisit auto-created for that
// meeting (source: MEETING_ASSIGNED) that's still PENDING / IN_PROGRESS
// should be cancelled too — otherwise it sits forever on the marketing
// person's visit list with nothing to actually visit for, and admin has
// no way to tell it's dead just by looking at the visits list.
export async function cancelPendingVisitsForLead(leadId: string, note: string) {
  await prisma.clientVisit.updateMany({
    where: {
      leadId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    data: {
      status: 'CANCELLED',
      notes: note,
    },
  })
}
