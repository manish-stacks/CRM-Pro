// src/lib/clientAccess.ts
// Client visibility for TL (MANAGER): clients they added/imported, clients an
// admin assigned to them, and clients whose service they head as project manager.
import { prisma } from '@/lib/prisma'
import { isCompanyWideRole } from '@/lib/permissions'
import { hasMinRole } from '@/lib/auth'

export async function managerClientWhere(userId: string) {
  const headed = await prisma.projectAssignment.findMany({
    where: { managerId: userId, isActive: true },
    select: { clientService: { select: { clientId: true } } },
  })
  const ids = Array.from(new Set(headed.map(a => a.clientService.clientId)))
  return {
    OR: [
      { createdById: userId },
      { assignedToId: userId },
      ...(ids.length ? [{ id: { in: ids } }] : []),
    ],
  }
}

export async function canAccessClient(session: { role: string; userId: string }, clientId: string) {
  if (session.role !== 'MANAGER') return true
  const hit = await prisma.client.findFirst({
    where: { id: clientId, ...(await managerClientWhere(session.userId)) },
    select: { id: true },
  })
  return !!hit
}

export async function attachCreators<T extends { createdById?: string | null }>(clients: T[]) {
  const ids = Array.from(new Set(clients.map(c => c.createdById).filter(Boolean))) as string[]
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } })
    : []
  const map = new Map(users.map(u => [u.id, u]))
  return clients.map(c => ({ ...c, createdBy: c.createdById ? map.get(c.createdById) || null : null }))
}

// Phone duplicate check — compares the last 10 digits so "98111 15689",
// "+91 9811115689" and "9811115689" count as the same number.
export const normPhone = (p: any) => String(p ?? '').replace(/\D/g, '').slice(-10)

export async function loadPhoneMap(excludeId?: string) {
  const rows = await prisma.client.findMany({
    where: excludeId ? { id: { not: excludeId } } : {},
    select: { phone: true, clientCode: true },
  })
  return new Map(rows.map(r => [normPhone(r.phone), r.clientCode]))
}

// Project team permissions for one client service.
//  full    -> admin, or the person who added / was assigned the client:
//             may set the project head and members
//  members -> full, or the active project head of that service: members only
export async function projectPerms(session: { role: string; userId: string }, clientServiceId: string) {
  if (hasMinRole(session.role, 'ADMIN')) return { full: true, members: true }
  const svc = await prisma.clientService.findUnique({
    where: { id: clientServiceId },
    select: { client: { select: { createdById: true, assignedToId: true } } },
  })
  if (!svc) return { full: false, members: false }
  const owner = svc.client.createdById === session.userId || svc.client.assignedToId === session.userId
  if (owner) return { full: true, members: true }
  const head = await prisma.projectAssignment.findFirst({
    where: { clientServiceId, managerId: session.userId, isActive: true },
    select: { id: true },
  })
  return { full: false, members: !!head }
}

export const canAssignClients = (role: string) => isCompanyWideRole(role)
