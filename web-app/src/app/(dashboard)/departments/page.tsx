'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Textarea, Modal, EmptyState, Select } from '@/components/ui'
import {
  Building2, Plus, Edit3, Trash2, Users, UserCheck, History,
  Loader2, X, Info, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const COLORS = ['blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'cyan', 'slate']
const ICONS = ['Building2', 'Briefcase', 'Code2', 'Megaphone', 'Search', 'MapPin', 'Target', 'TrendingUp', 'Share2', 'Palette', 'Users']

const colorMap: Record<string, string> = {
  blue: 'bg-brand-100 text-brand-700 border-blue-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  rose: 'bg-brand-100 text-brand-700 border-brand-200',
}

export default function DepartmentsPage() {
  const { isAtLeast } = useAuth()
  const canEdit = isAtLeast('ADMIN')

  const [depts, setDepts] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'none' | 'add' | 'edit' | 'manager'>('none')
  const [target, setTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ name: '', description: '', color: 'blue', icon: 'Building2', managerId: '' })
  const [managerForm, setManagerForm] = useState({ managerId: '', reason: '' })

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/departments')
      setDepts(r.data.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  useEffect(() => {
    if (canEdit) {
      api.get('/employees?role=MANAGER&limit=200').then(r => setEmployees(r.data.data || [])).catch(() => { })
    }
  }, [canEdit])


  const openAdd = () => {
    setTarget(null)
    setForm({ name: '', description: '', color: 'blue', icon: 'Building2', managerId: '' })
    setModal('add')
  }
  const openEdit = (d: any) => {
    setTarget(d)
    setForm({
      name: d.name, description: d.description || '',
      color: d.color || 'blue', icon: d.icon || 'Building2',
      managerId: d.managerId || '',
    })
    setModal('edit')
  }
  const openMgr = (d: any) => {
    setTarget(d)
    setManagerForm({ managerId: d.managerId || '', reason: '' })
    setModal('manager')
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    try {
      if (modal === 'edit') {
        await api.put(`/departments/${target.id}`, {
          name: form.name, description: form.description, color: form.color, icon: form.icon,
        })
        toast.success('Updated!')
      } else {
        await api.post('/departments', form)
        toast.success('Created!')
      }
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const changeMgr = async () => {
    setSaving(true)
    try {
      await api.post(`/departments/${target.id}/manager`, managerForm)
      toast.success('Manager updated!')
      setModal('none')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const remove = async (d: any) => {
    if (!confirm(`Delete department "${d.name}"?`)) return
    try {
      await api.delete(`/departments/${d.id}`)
      toast.success('Deleted!')
      fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage teams and assign department managers</p>
        </div>
        {canEdit && <Button onClick={openAdd}><Plus size={14} /> Add Department</Button>}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-5 h-40 skeleton" />)}
        </div>
      ) : depts.length === 0 ? (
        <div className="card p-8"><EmptyState icon={<Building2 size={40} />} title="No departments" description="Create your first department" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {depts.map(d => (
            <div key={d.id} className="card p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorMap[d.color] || colorMap.blue}`}>
                  <Building2 size={22} />
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(d)} className="btn-ghost btn-sm !p-1.5"><Edit3 size={13} /></button>
                    <button onClick={() => remove(d)} className="btn-ghost btn-sm !p-1.5 hover:!text-red-600"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>

              <h3 className="font-bold text-gray-900">{d.name}</h3>
              {d.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.description}</p>}

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Employees</p>
                  <p className="font-bold text-gray-900 flex items-center gap-1"><Users size={13} /> {d._count?.employees || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Manager</p>
                  {d.manager ? (
                    <p className="font-medium text-gray-900 text-sm truncate">{d.manager.user?.name}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Not assigned</p>
                  )}
                </div>
              </div>

              {canEdit && (
                <button
                  onClick={() => openMgr(d)}
                  className="w-full mt-4 text-xs text-brand-600 hover:bg-brand-50 py-2 rounded-lg flex items-center justify-center gap-1 font-semibold"
                >
                  <UserCheck size={12} /> {d.managerId ? 'Change Manager' : 'Assign Manager'} <ChevronRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal('none')} title={modal === 'edit' ? 'Edit Department' : 'Add Department'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Web Developer" />
          <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          <div>
            <label className="label">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} type="button"
                  className={`w-8 h-8 rounded-lg border-2 ${colorMap[c]} ${form.color === c ? 'ring-2 ring-offset-2 ring-brand-500' : ''}`} />
              ))}
            </div>
          </div>
          {modal === 'add' && (
            <div>
              <label className="label">Manager (optional)</label>
              <select value={form.managerId} onChange={e => setForm(p => ({ ...p, managerId: e.target.value }))} className="input">
                <option value="">None</option>
                {employees.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.user.name} ({e.employeeId})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={save} loading={saving}>{modal === 'edit' ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Change Manager Modal */}
      <Modal open={modal === 'manager'} onClose={() => setModal('none')} title={`Change Manager — ${target?.name}`}>
        <div className="space-y-4">
          {target?.manager && (
            <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-blue-900">Current Manager</p>
              <p className="text-brand-700">{target.manager.user?.name}</p>
            </div>
          )}
          <label className="label">New Manager</label>
          <select  value={managerForm.managerId} onChange={e => setManagerForm(p => ({ ...p, managerId: e.target.value }))} className="input">
            <option value="">Unassign</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>{e.user.name} — {e.position || e.employeeId}</option>
            ))}
          </select>
          <Textarea label="Reason (optional)" value={managerForm.reason}
            onChange={e => setManagerForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="e.g. Manish promoted to head of Web Developer team"
            rows={3} />
          <p className="text-xs text-gray-500 flex items-start gap-1">
            <Info size={11} className="text-gray-400 flex-shrink-0 mt-0.5" />
            The new manager will immediately see all this department's employees' attendance, leaves, and assigned clients.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={changeMgr} loading={saving}>Update Manager</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
