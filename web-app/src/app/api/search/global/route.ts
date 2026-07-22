// src/app/api/search/global/route.ts
// Powers the header search bar — searches Clients, Leads, Employees and
// Invoices in parallel and returns a small grouped result set. Mirrors the
// exact same role-based visibility each of those modules already enforces
// on their own list pages (TELECALLER → own, MARKETING_EXECUTIVE → own,
// EMPLOYEE → none for clients/leads/invoices; team-scope for employees),
// so this never leaks a record the user couldn't otherwise see.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { successResponse, unauthorizedResponse } from '@/lib/api'
import { getTeamScope } from '@/lib/teamScope'

const PER_GROUP = 5

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const session = (auth as any).session

  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (q.length < 2) return successResponse({ clients: [], leads: [], employees: [], invoices: [] })

  const role = session.role
  const canSeeAllCrm = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role)

  // ---- Clients ----
  const clientsWhere: any = {
    OR: [
      { clientName: { contains: q } },
      { companyName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ],
  }
  if (role === 'TELECALLER') clientsWhere.telecallerId = session.userId
  else if (role === 'MARKETING_EXECUTIVE') clientsWhere.marketingPersonId = session.userId
  else if (role === 'EMPLOYEE') clientsWhere.id = '__none__'

  // ---- Leads ----
  const leadsWhere: any = {
    OR: [
      { leadNumber: { contains: q } },
      { clientName: { contains: q } },
      { companyName: { contains: q } },
      { clientPhone: { contains: q } },
      { clientEmail: { contains: q } },
    ],
  }
  if (role === 'TELECALLER') leadsWhere.assignedToId = session.userId
  else if (role === 'MARKETING_EXECUTIVE') leadsWhere.meetingAssignedToId = session.userId
  else if (role === 'EMPLOYEE') leadsWhere.id = '__none__'

  // ---- Invoices ----
  const invoicesWhere: any = {
    OR: [
      { invoiceNumber: { contains: q } },
      { client: { clientName: { contains: q } } },
    ],
  }
  if (role === 'TELECALLER') invoicesWhere.client = { telecallerId: session.userId }
  else if (role === 'MARKETING_EXECUTIVE') invoicesWhere.client = { marketingPersonId: session.userId }
  else if (role === 'EMPLOYEE') invoicesWhere.id = '__none__'

  // ---- Employees ---- (team-scope for non-admins, same as /api/employees)
  let employeesWhere: any = {
    OR: [
      { user: { name: { contains: q } } },
      { user: { email: { contains: q } } },
      { employeeId: { contains: q } },
    ],
  }
  if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
    const scope = await getTeamScope(session.userId)
    employeesWhere.id = { in: scope.visibleIds.length ? scope.visibleIds : ['__none__'] }
  }

  const [clients, leads, employees, invoices] = await Promise.all([
    prisma.client.findMany({ where: clientsWhere, take: PER_GROUP, select: { id: true, clientName: true, companyName: true } }).catch(() => []),
    canSeeAllCrm || role === 'TELECALLER' || role === 'MARKETING_EXECUTIVE'
      ? prisma.lead.findMany({ where: leadsWhere, take: PER_GROUP, select: { id: true, leadNumber: true, clientName: true, companyName: true } }).catch(() => [])
      : Promise.resolve([]),
    prisma.employee.findMany({ where: employeesWhere, take: PER_GROUP, select: { id: true, employeeId: true, user: { select: { name: true } } } }).catch(() => []),
    canSeeAllCrm || role === 'TELECALLER' || role === 'MARKETING_EXECUTIVE'
      ? prisma.invoice.findMany({ where: invoicesWhere, take: PER_GROUP, select: { id: true, invoiceNumber: true, client: { select: { clientName: true } } } }).catch(() => [])
      : Promise.resolve([]),
  ])

  return successResponse({
    clients: clients.map(c => ({ id: c.id, label: c.clientName, sub: c.companyName, link: `/clients/${c.id}` })),
    leads: leads.map((l: any) => ({ id: l.id, label: l.clientName, sub: `${l.leadNumber}${l.companyName ? ` · ${l.companyName}` : ''}`, link: `/leads/${l.id}` })),
    employees: employees.map((e: any) => ({ id: e.id, label: e.user?.name, sub: e.employeeId, link: `/employees/${e.id}` })),
    invoices: invoices.map((i: any) => ({ id: i.id, label: i.invoiceNumber, sub: i.client?.clientName, link: `/invoices/${i.id}` })),
  })
}
