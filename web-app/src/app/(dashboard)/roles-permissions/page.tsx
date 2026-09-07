'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Textarea, Modal, EmptyState, Spinner } from '@/components/ui'
import {
  Shield, Plus, Trash2, Pencil, Check, X, Search,
  ShieldAlert, Copy, UserPlus, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'

const BASE_ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Company-wide (Admin)',
  MANAGER: 'Team-wide (Team Lead)',
  MARKETING_EXECUTIVE: 'Own + assigned clients (Marketing)',
  TELECALLER: 'Own leads only (Telecaller)',
  EMPLOYEE: 'Own records only (Employee)',
}

const BASE_ROLE_HELP: Record<string, string> = {
  ADMIN: 'Sees every client, lead, employee and payment in the company.',
  MANAGER: 'Sees their department/team — their team\u2019s leads, clients and projects.',
  MARKETING_EXECUTIVE: 'Sees the leads, clients and meetings assigned to them.',
  TELECALLER: 'Sees only the leads they created or that were assigned to them.',
  EMPLOYEE: 'Sees only their own attendance, projects and tickets.',
}

interface Module { key: string; label: string; group: string; actions: string[] }
interface Role {
  id: string; key: string; name: string; description?: string | null
  baseRole: string; permissions: string[]; isSystem: boolean; isActive: boolean
  userCount?: number
}

export default function RolesPage() {
  const { can } = useAuth()
  const canManage = can('roles.manage')

  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [baseRoles, setBaseRoles] = useState<string[]>([])
  const [defaults, setDefaults] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const [editor, setEditor] = useState<{ mode: 'new' | 'edit'; role: Role | null } | null>(null)
  const [form, setForm] = useState<any>({ name: '', description: '', baseRole: 'EMPLOYEE', permissions: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const [assignFor, setAssignFor] = useState<Role | null>(null)
  const [people, setPeople] = useState<any[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [peopleSearch, setPeopleSearch] = useState('')
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/roles')
      setRoles(r.data.data.roles || [])
      setModules(r.data.data.modules || [])
      setBaseRoles(r.data.data.baseRoles || [])
      setDefaults(r.data.data.defaults || {})
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not load roles')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const map: Record<string, Module[]> = {}
    for (const m of modules) {
      if (filter && !`${m.label} ${m.key} ${m.group}`.toLowerCase().includes(filter.toLowerCase())) continue
      ;(map[m.group] ||= []).push(m)
    }
    return map
  }, [modules, filter])

  // ---------- editor ----------
  const openNew = () => {
    // baseRole is fixed to ADMIN (company-wide data scope) for every custom
    // role now — actual visibility is controlled purely by the permissions
    // picked below, so there's no separate "data access level" to confuse.
    setForm({ name: '', description: '', baseRole: 'ADMIN', permissions: defaults.EMPLOYEE || [] })
    setFilter('')
    setEditor({ mode: 'new', role: null })
  }

  const openEdit = (role: Role) => {
    setForm({
      name: role.name, description: role.description || '',
      baseRole: role.baseRole, permissions: [...role.permissions],
    })
    setFilter('')
    setEditor({ mode: 'edit', role })
  }

  const has = (perm: string) => form.permissions.includes(perm)

  const toggle = (perm: string) => {
    setForm((p: any) => ({
      ...p,
      permissions: p.permissions.includes(perm)
        ? p.permissions.filter((x: string) => x !== perm)
        : [...p.permissions, perm],
    }))
  }

  const toggleModule = (m: Module) => {
    const all = m.actions.map(a => `${m.key}.${a}`)
    const allOn = all.every(p => form.permissions.includes(p))
    setForm((p: any) => ({
      ...p,
      permissions: allOn
        ? p.permissions.filter((x: string) => !all.includes(x))
        : Array.from(new Set([...p.permissions, ...all])),
    }))
  }

  const toggleGroup = (groupModules: Module[]) => {
    const all = groupModules.flatMap(m => m.actions.map(a => `${m.key}.${a}`))
    const allOn = all.every(p => form.permissions.includes(p))
    setForm((p: any) => ({
      ...p,
      permissions: allOn
        ? p.permissions.filter((x: string) => !all.includes(x))
        : Array.from(new Set([...p.permissions, ...all])),
    }))
  }

  const applyPreset = (baseRole: string) => {
    // Only copies the permission checkboxes now — data scope stays ADMIN.
    setForm((p: any) => ({ ...p, permissions: defaults[baseRole] || [] }))
    toast.success(`Loaded ${baseRole.replace(/_/g, ' ')} preset`)
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Role name is required'); return }
    setSaving(true)
    try {
      if (editor?.mode === 'new') {
        await api.post('/roles', form)
        toast.success('Role created')
      } else {
        await api.put(`/roles/${editor!.role!.id}`, form)
        toast.success('Role updated')
      }
      setEditor(null)
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const remove = async (role: Role) => {
    if (!confirm(`Delete the "${role.name}" role?`)) return
    try {
      await api.delete(`/roles/${role.id}`)
      toast.success('Role deleted')
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Delete failed') }
  }

  const toggleActive = async (role: Role) => {
    if (role.key === 'SUPER_ADMIN') { toast.error('Super Admin cannot be disabled'); return }
    try {
      await api.put(`/roles/${role.id}`, { isActive: !role.isActive })
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
  }

  // ---------- assignment ----------
  const openAssign = async (role: Role) => {
    setAssignFor(role)
    setPicked([])
    setPeopleSearch('')
    try {
      const r = await api.get('/employees?limit=200')
      setPeople(r.data.data || [])
    } catch { setPeople([]) }
  }

  const doAssign = async () => {
    if (!picked.length) { toast.error('Pick at least one person'); return }
    setAssigning(true)
    try {
      const r = await api.post('/roles/assign', { userIds: picked, roleId: assignFor!.id })
      toast.success(`${r.data.data.updated} user(s) moved to ${assignFor!.name}`)
      setAssignFor(null)
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setAssigning(false) }
  }

  const filteredPeople = people.filter((e: any) => {
    if (!peopleSearch.trim()) return true
    const q = peopleSearch.toLowerCase()
    return `${e.user?.name || ''} ${e.employeeId || ''} ${e.user?.email || ''}`.toLowerCase().includes(q)
  })

  const selectedCount = form.permissions.length

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} /></div>

  if (!can('roles.view')) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card p-8">
        <ShieldAlert size={38} className="mx-auto text-gray-300 mb-3" />
        <h2 className="font-semibold text-gray-900 mb-1">Not allowed</h2>
        <p className="text-sm text-gray-500">You don&apos;t have permission to view roles.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={20} className="text-brand-600" /> Roles &amp; Permissions
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Build a role, tick exactly what it can reach, then move people onto it. Anyone without a custom role keeps their built-in defaults.
          </p>
        </div>
        {canManage && <Button onClick={openNew}><Plus size={14} /> New Role</Button>}
      </div>

      {roles.length === 0 ? (
        <EmptyState
          icon={<Shield size={20} />}
          title="No roles yet"
          description="Built-in roles are created automatically — refresh, or add a custom one"
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-right px-4 py-3 w-28">Members</th>
                <th className="text-left px-4 py-3 w-56">Data access</th>
                <th className="text-right px-4 py-3 w-32">Permissions</th>
                <th className="text-left px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${r.isActive ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-3 border-l-[3px] border-brand-500">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${r.isSystem ? 'text-gray-900' : 'text-gray-800'}`}>{r.name}</span>
                      {r.isSystem && <Lock size={12} className="text-gray-400" />}
                    </div>
                    {r.description
                      ? <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                      : <p className="text-[11px] text-gray-400 font-mono mt-0.5">{r.key}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.userCount || 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{BASE_ROLE_LABEL[r.baseRole] || r.baseRole.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.permissions.length}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <button onClick={() => openEdit(r)} title="Edit permissions"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-brand-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => openAssign(r)} title="Assign people"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-brand-600">
                          <UserPlus size={15} />
                        </button>
                      )}
                      {canManage && !r.isSystem && (
                        <>
                          <button onClick={() => toggleActive(r)} title={r.isActive ? 'Disable' : 'Enable'}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                            {r.isActive ? <X size={15} /> : <Check size={15} />}
                          </button>
                          <button onClick={() => remove(r)} title="Delete"
                            className="p-1.5 rounded hover:bg-red-50 text-red-500">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- editor ---------------- */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'new' ? 'New role' : `Edit role — ${editor?.role?.name}`}
      >
        <div className="space-y-4">
          <p className="-mt-2 text-xs text-gray-500">{selectedCount} permission(s) selected</p>

          {/* Data access is always company-wide now — whatever permissions
              are checked below is exactly what this role can see and do.
              No separate "data access level" to set/confuse. */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11.5px] text-slate-600 leading-relaxed">
            <b className="text-slate-800">Permissions</b> decide <i>which screens, buttons and records</i> this role can reach.
            Whatever you enable below is exactly what this role will see — nothing more, nothing less.
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Role Name *"
              value={form.name}
              onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
              placeholder="Sub Admin"
              disabled={editor?.role?.isSystem}
            />
            <Textarea
              label="Description"
              rows={1}
              value={form.description}
              onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
              placeholder="More administrative tasks, excluding settings and roles"
            />
          </div>

          <div>
            <label className="label">Copy permissions from</label>
            <div className="flex flex-wrap gap-1.5">
              {baseRoles.map(r => (
                <button key={r} type="button" onClick={() => applyPreset(r)}
                  className="btn-secondary btn-sm text-[11px]">
                  <Copy size={11} /> {r.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-7 text-xs" placeholder="Filter modules..."
                value={filter} onChange={e => setFilter(e.target.value)} />
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setForm((p: any) => ({ ...p, permissions: modules.flatMap(m => m.actions.map(a => `${m.key}.${a}`)) }))}
                className="text-xs text-brand-600 hover:underline">Select all</button>
              <span className="text-gray-300">·</span>
              <button type="button" onClick={() => setForm((p: any) => ({ ...p, permissions: [] }))}
                className="text-xs text-gray-500 hover:underline">Clear all</button>
            </div>
          </div>

          {/* Permission matrix — one card per module, grouped by area */}
          <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-5">
            {Object.entries(groups).map(([group, mods]) => {
              const groupPerms = mods.flatMap(m => m.actions.map(a => `${m.key}.${a}`))
              const groupOn = groupPerms.filter(p => form.permissions.includes(p)).length
              return (
                <div key={group}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">{group}</h4>
                    <button type="button" onClick={() => toggleGroup(mods)}
                      className="text-[11px] text-brand-600 hover:underline">
                      {groupOn === groupPerms.length ? 'Uncheck all' : 'Check all'} ({groupOn}/{groupPerms.length})
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mods.map(m => {
                      const perms = m.actions.map(a => `${m.key}.${a}`)
                      const on = perms.filter(p => form.permissions.includes(p)).length
                      const allOn = on === perms.length
                      return (
                        <div key={m.key}
                          className={`rounded-lg border p-3 transition-colors ${allOn ? 'border-brand-200 bg-brand-50/40' : on ? 'border-gray-200' : 'border-gray-200 bg-gray-50/60'}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <button type="button" onClick={() => toggleModule(m)}
                              className="text-[11px] font-bold text-gray-700 tracking-wide uppercase text-left hover:text-brand-600">
                              {m.label}
                            </button>
                            <span className={`text-[11px] font-semibold ${allOn ? 'text-brand-600' : 'text-gray-400'}`}>{on}/{perms.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {m.actions.map(a => {
                              const perm = `${m.key}.${a}`
                              return (
                                <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={has(perm)}
                                    onChange={() => toggle(perm)}
                                    className="w-4 h-4 rounded accent-brand-600"
                                  />
                                  <span className={`text-xs font-mono ${has(perm) ? 'text-gray-800' : 'text-gray-400'} group-hover:text-gray-900`}>{a}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {Object.keys(groups).length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">No modules match &quot;{filter}&quot;</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setEditor(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save role</Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- assign ---------------- */}
      <Modal open={!!assignFor} onClose={() => setAssignFor(null)} title={`Assign — ${assignFor?.name || ''}`}>
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Selected people move onto this role, and their data access level becomes{' '}
            <b>{BASE_ROLE_LABEL[assignFor?.baseRole || ''] || assignFor?.baseRole?.replace(/_/g, ' ')}</b>.
            Super admins are skipped.
          </p>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-7 text-sm" placeholder="Search employees..."
              value={peopleSearch} onChange={e => setPeopleSearch(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {filteredPeople.length === 0 ? (
              <p className="text-xs text-gray-400 p-3">No employees found</p>
            ) : filteredPeople.map((e: any) => {
              const uid = e.user?.id
              const checked = picked.includes(uid)
              return (
                <label key={e.id} className={`flex items-center gap-2.5 p-2.5 cursor-pointer text-sm ${checked ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={checked} className="accent-brand-600"
                    onChange={() => setPicked(p => checked ? p.filter(x => x !== uid) : [...p, uid])} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{e.user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {e.employeeId} · {e.user?.role?.replace(/_/g, ' ')}
                      {e.user?.appRole?.name ? ` · ${e.user.appRole.name}` : ''}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={doAssign} loading={assigning}>Assign {picked.length || ''}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
