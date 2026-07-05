'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, Modal, EmptyState, Pagination, Badge } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import {
  Users2, Plus, Search, Filter, X, Package, User, Building2,
  UserPlus, Trash2, Loader2, Briefcase, Shield
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProjectsPage() {
  const { user, isAtLeast } = useAuth()
  const canManage = isAtLeast('MANAGER')

  const [assignments, setAssignments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({ clientId: '', departmentId: '', isActive: 'true' })

  const [modal, setModal] = useState<'none' | 'assign'>('none')
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [clientServices, setClientServices] = useState<any[]>([])

  const [form, setForm] = useState({
    clientId: '', clientServiceId: '', managerId: '', memberIds: [] as string[], role: 'MEMBER',
  })

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/projects?${new URLSearchParams(p)}`)
      setAssignments(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    api.get('/clients?limit=200').then(r => setClients(r.data.data || [])).catch(() => {})
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => {})
    api.get('/users/by-role?roles=EMPLOYEE,MANAGER').then(r => setUsers(r.data.data || [])).catch(() => {})
  }, [])

  // When client picked, load its services
  useEffect(() => {
    if (form.clientId) {
      api.get(`/clients/${form.clientId}/services`).then(r => setClientServices(r.data.data || [])).catch(() => {})
    } else setClientServices([])
  }, [form.clientId])

  const openAssign = () => {
    setForm({ clientId: '', clientServiceId: '', managerId: '', memberIds: [], role: 'MEMBER' })
    setModal('assign')
  }

  const toggleMember = (uid: string) => {
    setForm(p => ({
      ...p,
      memberIds: p.memberIds.includes(uid) ? p.memberIds.filter(x => x !== uid) : [...p.memberIds, uid],
    }))
  }

  const assign = async () => {
    if (!form.clientServiceId) { toast.error('Select a service'); return }
    if (!form.managerId && form.memberIds.length === 0) { toast.error('Pick manager or members'); return }
    setSaving(true)
    try {
      const r = await api.post('/projects', {
        clientServiceId: form.clientServiceId,
        managerId: form.managerId || undefined,
        memberIds: form.memberIds,
        role: form.role,
      })
      toast.success(`Assigned ${r.data.data?.count || 0} person(s)`)
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const remove = async (assignId: string) => {
    if (!confirm('Remove this assignment?')) return
    try {
      await api.delete(`/projects/${assignId}`)
      toast.success('Removed')
      fetch_()
    } catch { toast.error('Failed') }
  }

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'true').length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Assignments</h1>
          <p className="text-sm text-gray-500 mt-1">Connect client services with the dept manager and team members</p>
        </div>
        {canManage && <Button onClick={openAssign}><UserPlus size={14} /> Assign Team</Button>}
      </div>

      <div className="card">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <select value={filters.clientId} onChange={e => { setFilters(p => ({...p, clientId: e.target.value})); setPage(1) }} className="max-w-xs input">
            <option value="">All clients</option>
            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.clientName}</option>)}
          </select>
          <select value={filters.departmentId} onChange={e => { setFilters(p => ({...p, departmentId: e.target.value})); setPage(1) }} className="max-w-xs input">
            <option value="">All departments</option>
            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filters.isActive} onChange={e => { setFilters(p => ({...p, isActive: e.target.value})); setPage(1) }} className="max-w-xs input">
            <option value="true">Active only</option>
            <option value="false">Inactive</option>
            <option value="">All</option>
          </select>
          <span className="text-xs text-gray-500 ml-auto">{total} assignments</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Client & Service</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Members</th>
                <th>Assigned</th>
                <th>Status</th>
                {canManage && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8"><Loader2 className="animate-spin inline text-gray-400" /></td></tr>
              ) : assignments.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={<Briefcase size={40} />} title="No assignments" description="Assign team members to client services" /></td></tr>
              ) : (
                // Group by clientServiceId — show manager row + member rows
                Object.values(assignments.reduce((acc: any, a: any) => {
                  const key = a.clientService.id
                  if (!acc[key]) acc[key] = { service: a.clientService, manager: null, members: [], assignedAt: a.assignedAt, isActive: a.isActive }
                  if (a.role === 'MANAGER' || a.managerId) acc[key].manager = a
                  else acc[key].members.push(a)
                  return acc
                }, {})).map((group: any) => (
                  <tr key={group.service.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/clients/${group.service.client.id}`} className="hover:text-blue-600">
                        <p className="font-medium text-sm">{group.service.client.clientName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Package size={10} /> {group.service.serviceName}</p>
                      </Link>
                    </td>
                    <td>
                      {group.service.department ? (
                        <span className="badge bg-slate-100 text-slate-700 text-xs">{group.service.department.name}</span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td>
                      {group.manager?.manager ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                            {getInitials(group.manager.manager.name)}
                          </div>
                          <span className="text-sm">{group.manager.manager.name}</span>
                          {canManage && group.manager.isActive && (
                            <button onClick={() => remove(group.manager.id)} className="text-red-500 hover:bg-red-50 rounded p-0.5" title="Remove"><Trash2 size={11} /></button>
                          )}
                        </div>
                      ) : <span className="text-xs text-gray-400">— No manager —</span>}
                    </td>
                    <td>
                      {group.members.length === 0 ? <span className="text-xs text-gray-400">—</span> : (
                        <div className="flex flex-wrap gap-1">
                          {group.members.map((m: any) => (
                            <div key={m.id} className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded px-2 py-0.5 text-xs">
                              <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                                {getInitials(m.member?.name || 'X')}
                              </div>
                              <span>{m.member?.name}</span>
                              {canManage && m.isActive && (
                                <button onClick={() => remove(m.id)} className="text-red-500 hover:bg-red-100 rounded" title="Remove"><X size={10} /></button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(group.assignedAt)}</td>
                    <td>
                      {group.isActive ? <span className="badge bg-emerald-100 text-emerald-700">Active</span> : <span className="badge bg-gray-100 text-gray-600">Inactive</span>}
                    </td>
                    {canManage && (
                      <td className="text-right">
                        <button onClick={() => {
                          setForm({ clientId: group.service.client.id, clientServiceId: group.service.id, managerId: '', memberIds: [], role: 'MEMBER' })
                          setModal('assign')
                        }} className="btn-ghost btn-sm !p-1.5" title="Add more">
                          <UserPlus size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>

      {/* Assign Modal */}
      <Modal open={modal === 'assign'} onClose={() => setModal('none')} title="Assign Team to Project">
        <div className="space-y-3">
          <Select label="Client *" value={form.clientId} onChange={e => setForm(p => ({...p, clientId: e.target.value, clientServiceId: ''}))} options={[{ value: '', label: 'Pick a client...' }, ...clients.map((c: any) => ({ value: c.id, label: `${c.clientName} — ${c.companyName}` }))] } />
          <Select label="Service *" value={form.clientServiceId} onChange={e => setForm(p => ({...p, clientServiceId: e.target.value}))} disabled={!form.clientId} options={[{ value: '', label: form.clientId ? 'Pick a service...' : 'Pick client first' }, ...clientServices.map((s: any) => ({ value: s.id, label: `${s.serviceName} — ${s.status}` }))]} />
          <Select label="Manager (dept head)" value={form.managerId} onChange={e => setForm(p => ({...p, managerId: e.target.value}))} options={[{ value: '', label: '— No manager —' }, ...users.filter(u => u.role === 'MANAGER').map((u: any) => ({ value: u.id, label: `${u.name} (${u.employee?.department?.name || '—'})` }))]} />  
            
          <div>
            <label className="label">Team Members</label>
            <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
              {users.filter(u => u.role === 'EMPLOYEE' || u.id === user?.id).map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1">
                    <p>{u.name}</p>
                    <p className="text-xs text-gray-500">{u.employee?.department?.name || 'No dept'} · {u.role}</p>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{form.memberIds.length} selected</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={assign} loading={saving}><UserPlus size={13} /> Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
