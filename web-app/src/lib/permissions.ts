// src/lib/permissions.ts
// Single source of truth for the permission system. Safe to import from both
// server and client code — no prisma, no node APIs.
//
// A permission is "<module>.<action>", e.g. "clients.create".
// Built-in roles keep working exactly as before: if a user has no custom role
// attached, they fall back to the DEFAULT_ROLE_PERMISSIONS below.

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'manage' | 'export' | 'approve'

export interface PermissionModule {
  key: string
  label: string
  group: string
  actions: PermissionAction[]
}

/** Everything that can be permissioned, grouped the way the settings UI shows it. */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'General', actions: ['view'] },

  // HRM
  { key: 'employees', label: 'Employees', group: 'HRM', actions: ['view', 'create', 'update', 'delete', 'export'] },
  { key: 'attendance', label: 'Attendance', group: 'HRM', actions: ['view', 'manage', 'export'] },
  { key: 'leaves', label: 'Leaves', group: 'HRM', actions: ['view', 'manage', 'approve'] },
  { key: 'payroll', label: 'Payroll', group: 'HRM', actions: ['view', 'manage', 'export'] },
  { key: 'letters', label: 'Letters', group: 'HRM', actions: ['view', 'manage'] },
  { key: 'departments', label: 'Departments', group: 'HRM', actions: ['view', 'manage'] },

  // CRM
  { key: 'leads', label: 'Leads', group: 'CRM', actions: ['view', 'create', 'update', 'delete', 'export'] },
  { key: 'meetings', label: 'Meetings', group: 'CRM', actions: ['view', 'manage'] },
  { key: 'proposals', label: 'Proposals', group: 'CRM', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'clients', label: 'Clients', group: 'CRM', actions: ['view', 'create', 'update', 'delete', 'export'] },
  { key: 'services', label: 'Services', group: 'CRM', actions: ['view', 'manage'] },
  { key: 'projects', label: 'Projects', group: 'CRM', actions: ['view', 'manage'] },
  { key: 'seo_reports', label: 'SEO / GMB Reports', group: 'CRM', actions: ['view', 'create', 'update', 'delete'] },

  // Finance
  { key: 'invoices', label: 'Invoices', group: 'Finance', actions: ['view', 'create', 'update', 'delete'] },
  { key: 'payments', label: 'Payments', group: 'Finance', actions: ['view', 'manage'] },
  { key: 'reports', label: 'Finance Reports', group: 'Finance', actions: ['view', 'export'] },
  { key: 'collection', label: 'Daily Collection', group: 'Finance', actions: ['view', 'manage'] },

  // Support & comms
  { key: 'tickets', label: 'Client Tickets', group: 'Support', actions: ['view', 'manage'] },
  { key: 'chat', label: 'Team Chat', group: 'Support', actions: ['view'] },
  { key: 'announcements', label: 'Announcements', group: 'Support', actions: ['view', 'manage'] },
  { key: 'mail', label: 'Custom Mail', group: 'Support', actions: ['view', 'manage'] },

  // Field
  { key: 'visits', label: 'Visit Sheet', group: 'Field', actions: ['view', 'manage'] },
  { key: 'tracking', label: 'Field Tracking', group: 'Field', actions: ['view', 'manage'] },

  // Admin
  { key: 'settings', label: 'Settings', group: 'Administration', actions: ['view', 'manage'] },
  { key: 'roles', label: 'Roles & Permissions', group: 'Administration', actions: ['view', 'manage'] },
  { key: 'audit', label: 'Audit Log', group: 'Administration', actions: ['view'] },
  { key: 'import_export', label: 'Import / Export', group: 'Administration', actions: ['view', 'manage'] },
]

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSION_MODULES.map(m => m.group)))

/**
 * Single source of truth for the built-in role tiers. Every file that needs
 * to know "which roles are admin-like" / "which roles are team leads" /
 * "which roles only see their own records" should import from here instead
 * of hardcoding role-key arrays — so there's exactly one place to update if
 * a tier's membership ever changes.
 *
 * `scope` drives data visibility (not permissions):
 *  - company : sees every record in the company
 *  - team    : sees their department/team's records
 *  - assigned: sees records assigned to them (+ what they created)
 *  - own     : sees only their own records
 */
export type DataScope = 'company' | 'team' | 'assigned' | 'own'

export interface RoleMeta {
  key: string
  name: string
  description: string
  scope: DataScope
}

export const SYSTEM_ROLES: RoleMeta[] = [
  { key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full access — always has every permission.', scope: 'company' },
  { key: 'ADMIN', name: 'Admin', description: 'Everything except managing roles and permissions.', scope: 'company' },
  { key: 'MANAGER', name: 'Manager (TL)', description: 'Runs their team — leads, clients, projects and reports.', scope: 'team' },
  { key: 'MARKETING_EXECUTIVE', name: 'Marketing Executive', description: 'Leads, meetings, proposals, invoices and client work.', scope: 'assigned' },
  { key: 'TELECALLER', name: 'Telecaller', description: 'Calls leads and books meetings.', scope: 'own' },
  { key: 'EMPLOYEE', name: 'Employee', description: 'Day-to-day staff login — own attendance, projects and tickets.', scope: 'own' },
]

/** The base tiers a custom role's "data access level" can be built on (excludes SUPER_ADMIN, which is never assignable). */
export const BASE_ROLES: string[] = SYSTEM_ROLES.filter(r => r.key !== 'SUPER_ADMIN').map(r => r.key)

const ROLE_SCOPE: Record<string, DataScope> = Object.fromEntries(SYSTEM_ROLES.map(r => [r.key, r.scope]))

/** Resolve a role key's data scope. Unknown keys (custom roles seeded with a baseRole) fall back to 'own'. */
export function getDataScope(role: string | null | undefined): DataScope {
  if (!role) return 'own'
  return ROLE_SCOPE[role] || 'own'
}

export const isCompanyWideRole = (role: string | null | undefined) => getDataScope(role) === 'company'
export const isTeamScopeRole = (role: string | null | undefined) => getDataScope(role) === 'team'
export const isAssignedScopeRole = (role: string | null | undefined) => getDataScope(role) === 'assigned'
export const isOwnScopeRole = (role: string | null | undefined) => getDataScope(role) === 'own'

/** True for roles that see everything, or a whole team's worth (i.e. more than just their own/assigned records). */
export const canSeeBeyondOwn = (role: string | null | undefined) => {
  const s = getDataScope(role)
  return s === 'company' || s === 'team'
}

/** True for roles that see more than just their own records — company-wide, team, or assigned-to-them (i.e. NOT the strict "own only" tier). */
export const isNotOwnScopeRole = (role: string | null | undefined) => getDataScope(role) !== 'own'

/** Role keys with company-wide scope, e.g. for "fall back to an admin" defaults. */
export const COMPANY_WIDE_ROLES: string[] = SYSTEM_ROLES.filter(r => r.scope === 'company').map(r => r.key)

/** Every real staff role key (built-in), i.e. anyone who isn't a CLIENT/portal user. */
export const STAFF_ROLES: string[] = SYSTEM_ROLES.map(r => r.key)

/** Every valid permission string, e.g. ["dashboard.view", "clients.create", ...]. */
export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap(m =>
  m.actions.map(a => `${m.key}.${a}`)
)

const all = (key: string) =>
  (PERMISSION_MODULES.find(m => m.key === key)?.actions || []).map(a => `${key}.${a}`)

const viewOnly = (...keys: string[]) => keys.map(k => `${k}.view`)

/**
 * What each built-in role can do when no custom role is attached.
 * SUPER_ADMIN is special-cased in `can()` — it always passes.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  ADMIN: ALL_PERMISSIONS.filter(p => !p.startsWith('roles.')),

  MANAGER: [
    ...all('dashboard'),
    ...all('attendance'), ...all('leaves'),
    ...viewOnly('employees', 'payroll', 'departments'),
    ...all('leads'), ...all('meetings'), ...all('proposals'),
    ...all('clients'), ...all('projects'), ...all('seo_reports'),
    ...viewOnly('services', 'invoices'),
    ...all('tickets'), ...all('chat'),
    ...all('visits'), ...viewOnly('tracking'),
    ...all('import_export'),
  ],

  MARKETING_EXECUTIVE: [
    ...all('dashboard'),
    'attendance.view', 'leaves.view', 'leaves.manage',
    ...all('leads'), ...all('meetings'), ...all('proposals'),
    'clients.view', 'clients.create', 'clients.update',
    'projects.view', ...all('seo_reports'),
    ...all('invoices'),
    'tickets.view', 'tickets.manage', ...all('chat'),
    ...all('visits'),
  ],

  TELECALLER: [
    ...all('dashboard'),
    'attendance.view', 'leaves.view', 'leaves.manage',
    'leads.view', 'leads.create', 'leads.update',
    ...all('meetings'),
    ...all('chat'),
  ],

  EMPLOYEE: [
    ...all('dashboard'),
    'attendance.view', 'leaves.view', 'leaves.manage',
    'projects.view', 'seo_reports.view', 'seo_reports.create', 'seo_reports.update',
    'tickets.view', 'tickets.manage',
    ...all('chat'),
  ],

  CLIENT: [],
}

/** Does this permission list satisfy `permission`? `manage` implies the rest. */
export function checkPermission(
  granted: string[] | null | undefined,
  permission: string,
  role?: string
): boolean {
  if (role === 'SUPER_ADMIN') return true
  if (!permission) return true
  const list = granted && granted.length ? granted : (role ? DEFAULT_ROLE_PERMISSIONS[role] || [] : [])
  if (list.includes(permission)) return true

  // "<module>.manage" is a superset of every other action on that module
  const [mod] = permission.split('.')
  if (list.includes(`${mod}.manage`)) return true
  return false
}

/** Keeps only strings that exist in the catalog — guards against junk input. */
export function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const valid = new Set(ALL_PERMISSIONS)
  return Array.from(new Set(input.filter((p): p is string => typeof p === 'string' && valid.has(p))))
}

export function labelForModule(key: string) {
  return PERMISSION_MODULES.find(m => m.key === key)?.label || key
}
