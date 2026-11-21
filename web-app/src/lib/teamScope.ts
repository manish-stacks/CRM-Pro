// src/lib/teamScope.ts
// Which employees can a given user (by userId) see?
//   - always themselves
//   - everyone in departments they HEAD (Department.managerId = their employee.id)
//   - everyone who REPORTS to them (Employee.reportingToId = their employee.id)
// This covers department heads (any app-role) AND team leads in multi-lead departments.
import { prisma } from './prisma'

export interface TeamScope {
  empId: string | null
  visibleIds: string[]   // employee ids this user may view (includes self)
  canSeeTeam: boolean    // true if they head a dept or have direct reports
}

export async function getTeamScope(userId: string): Promise<TeamScope> {
  const me = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true, departmentId: true },
  })
  if (!me) return { empId: null, visibleIds: [], canSeeTeam: false }

  const ids = new Set<string>([me.id])

  // Departments I head (managerId may match employee id or user id) → all their employees
  const headedDepts = await prisma.department.findMany({
    where: {
      OR: [
        { managerId: me.id },
        { managerId: userId },
      ],
    },
    select: { id: true },
  })
  if (headedDepts.length) {
    const deptEmps = await prisma.employee.findMany({
      where: { departmentId: { in: headedDepts.map(d => d.id) } },
      select: { id: true },
    })
    deptEmps.forEach(e => ids.add(e.id))
  }

  // If user is a MANAGER in a department, include all employees in that department
  if (me.departmentId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    if (user?.role === 'MANAGER') {
      const deptEmps = await prisma.employee.findMany({
        where: { departmentId: me.departmentId },
        select: { id: true },
      })
      deptEmps.forEach(e => ids.add(e.id))
    }
  }

  // Direct reports (team-lead relationship). Check both employee id and user id.
  try {
    const reports = await prisma.employee.findMany({
      where: {
        OR: [
          { reportingToId: me.id },
          { reportingToId: userId },
        ],
      },
      select: { id: true },
    })
    reports.forEach(e => ids.add(e.id))
  } catch (e) {
    console.error('getTeamScope: reportingToId query failed (run team_lead migration):', (e as any)?.message)
  }

  return { empId: me.id, visibleIds: Array.from(ids), canSeeTeam: ids.size > 1 }
}

/**
 * Same team as getTeamScope, but returned as **User ids** — for records that
 * reference users (leads, proposals) rather than employees.
 */
export async function getTeamUserIds(userId: string): Promise<{ userIds: string[]; canSeeTeam: boolean }> {
  const scope = await getTeamScope(userId)
  const ids = new Set<string>([userId])
  if (scope.visibleIds.length) {
    const emps = await prisma.employee.findMany({
      where: { id: { in: scope.visibleIds } },
      select: { userId: true },
    })
    emps.forEach(e => { if (e.userId) ids.add(e.userId) })
  }

  // Also include any creator of leads currently assigned to or managed by this user
  try {
    const leadCreators = await prisma.lead.findMany({
      where: { assignedToId: userId },
      select: { createdById: true },
      distinct: ['createdById'],
    })
    leadCreators.forEach(l => { if (l.createdById) ids.add(l.createdById) })
  } catch { }

  return { userIds: Array.from(ids), canSeeTeam: ids.size > 1 }
}
