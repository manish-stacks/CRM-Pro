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
  const me = await prisma.employee.findFirst({ where: { userId }, select: { id: true } })
  if (!me) return { empId: null, visibleIds: [], canSeeTeam: false }

  const ids = new Set<string>([me.id])

  // Departments I head → all their employees
  const headedDepts = await prisma.department.findMany({
    where: { managerId: me.id },
    select: { id: true },
  })
  if (headedDepts.length) {
    const deptEmps = await prisma.employee.findMany({
      where: { departmentId: { in: headedDepts.map(d => d.id) } },
      select: { id: true },
    })
    deptEmps.forEach(e => ids.add(e.id))
  }

  // Direct reports (team-lead relationship).
  // Wrapped in try/catch so a not-yet-migrated `reportingToId` column can't crash
  // attendance/leaves/employees pages — run the migration to enable team-lead scoping.
  try {
    const reports = await prisma.employee.findMany({
      where: { reportingToId: me.id },
      select: { id: true },
    })
    reports.forEach(e => ids.add(e.id))
  } catch (e) {
    console.error('getTeamScope: reportingToId query failed (run team_lead migration):', (e as any)?.message)
  }

  return { empId: me.id, visibleIds: Array.from(ids), canSeeTeam: ids.size > 1 }
}