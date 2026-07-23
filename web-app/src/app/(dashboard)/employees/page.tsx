'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Modal, EmptyState, Pagination, Badge, Select } from '@/components/ui'
import { formatDate, getInitials } from '@/lib/utils'
import { generateIdCard } from '@/lib/idCard'
import {
  Users, Plus, Search, Filter, X, Eye, UserCheck, UserX, MoreVertical, Loader2, Download, IdCard
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']
const WORK_MODES = ['WFO', 'WFH', 'HYBRID']

export default function EmployeesPage() {
  const { isAtLeast } = useAuth()
  const canManage = isAtLeast('ADMIN')

  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({ search: '', departmentId: '', role: '', status: '' })
  const [company, setCompany] = useState<any>({ name: 'Hover Business Services' })

  const [modal, setModal] = useState<'none' | 'add' | 'toggle'>('none')
  const [target, setTarget] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'EMPLOYEE', position: '', departmentId: '',
    salary: '', workMode: 'WFO', joiningDate: new Date().toISOString().split('T')[0],
    dateOfBirth: '',
  })
  const [toggleReason, setToggleReason] = useState('')

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: '20' }
      Object.entries(filters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/employees?${new URLSearchParams(p)}`)
      setEmployees(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => {
    api.get('/settings').then(r => {
      const g = r.data.data?.grouped?.company || {}
      setCompany({ name: g.company_name || 'Hover Business Services', phone: g.company_phone, email: g.company_email })
    }).catch(() => {})
  }, [])
  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => {})
  }, [])

  const openAdd = () => {
    setForm({
      name: '', email: '', phone: '', password: '',
      role: 'EMPLOYEE', position: '', departmentId: '',
      salary: '', workMode: 'WFO', joiningDate: new Date().toISOString().split('T')[0],
      dateOfBirth: '',
    })
    setModal('add')
  }

  const create = async () => {
    if (!form.name || !form.email || !form.password) { toast.error('Name, email, password required'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }

    setSaving(true)
    try {
      await api.post('/employees', form)
      toast.success('Employee created! Auto-generated Employee ID assigned.')
      setModal('none')
      fetchEmployees()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create')
    } finally { setSaving(false) }
  }

  const openToggle = (emp: any) => {
    setTarget(emp)
    setToggleReason('')
    setModal('toggle')
  }

  const toggleStatus = async () => {
    if (!target) return
    const newStatus = !target.user.isActive
    if (!newStatus && !toggleReason.trim()) { toast.error('Reason required to disable'); return }
    setSaving(true)
    try {
      await api.post(`/employees/${target.id}/toggle-status`, { isActive: newStatus, reason: toggleReason })
      toast.success(newStatus ? 'Account enabled' : 'Account disabled')
      setModal('none')
      fetchEmployees()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const activeFilterCount = Object.values(filters).filter(v => v).length

  const exportEmployees = () => {
    const statusParam = filters.status === 'true' ? 'active' : filters.status === 'false' ? 'inactive' : 'all'
    window.open(`/api/import-export?type=employees&format=csv&status=${statusParam}`, '_blank')
  }

  const makeIdCard = async (e: any) => {
    try {
      const r = await api.get(`/employees/${e.id}`)
      const emp = r.data.data
      await generateIdCard({
        employeeId: emp.employeeId,
        name: emp.user?.name || e.user?.name,
        department: emp.department?.name,
        position: emp.position,
        bloodGroup: emp.bloodGroup,
        phone: emp.user?.phone,
        email: emp.user?.email,
        joiningDate: emp.joiningDate,
        avatarUrl: emp.user?.avatar,
        avatarInitials: getInitials(emp.user?.name || e.user?.name || 'NA'),
      }, company)
    } catch {
      toast.error('Id card not generated')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">
            {canManage ? 'Manage team members. New employees fill their own profile after login.' : 'Your team directory'}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportEmployees}>
              <Download size={14} /> Export{filters.status === 'true' ? ' (Active)' : filters.status === 'false' ? ' (Inactive)' : ''}
            </Button>
            <Button onClick={openAdd}><Plus size={14} /> Add Employee</Button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" className="input pl-9 text-sm" placeholder="Search name, email, or Employee ID"
                value={filters.search}
                onChange={e => { setFilters(p => ({...p, search: e.target.value})); setPage(1) }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{total} total</span>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`btn-secondary btn-sm ${activeFilterCount > 0 ? 'border-brand-500 text-brand-600' : ''}`}
            >
              <Filter size={13} /> Filters
              {activeFilterCount > 0 && <span className="ml-1 bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFilterCount}</span>}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={filters.departmentId} onChange={e => { setFilters(p => ({...p, departmentId: e.target.value})); setPage(1) }} className="input">
              <option value="">All Departments</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filters.role} onChange={e => { setFilters(p => ({...p, role: e.target.value})); setPage(1) }} className="input">
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={filters.status} onChange={e => { setFilters(p => ({...p, status: e.target.value})); setPage(1) }} className="input">
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilters({search:'',departmentId:'',role:'',status:''}); setPage(1) }}
                className="text-xs text-red-600 hover:underline flex items-center gap-1 col-span-full"
              >
                <X size={12} /> Clear all
              </button>
            )}
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID</th>
                <th>Role</th>
                <th>Department</th>
                <th>Joined</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={<Users size={40}/>} title="No employees" description="No employees match your filters" /></td></tr>
              ) : employees.map(e => (
                <tr key={e.id} className={!e.user.isActive ? 'opacity-60' : ''}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                        {e.user.avatar ? <img src={e.user.avatar} className="w-full h-full object-cover" /> : getInitials(e.user.name)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{e.user.name}</p>
                        <p className="text-xs text-gray-500">{e.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs">{e.employeeId}</td>
                  <td><Badge status={e.user.role} /></td>
                  <td className="text-sm">{e.department?.name || '—'}</td>
                  <td className="text-sm">{e.joiningDate ? formatDate(e.joiningDate) : '—'}</td>
                  <td>
                    {e.user.isActive ? (
                      <span className="badge bg-green-100 text-green-700">Active</span>
                    ) : (
                      <div>
                        <span className="badge bg-red-100 text-red-700">Disabled</span>
                        {e.user.disabledReason && <p className="text-xs text-red-500 mt-0.5" title={e.user.disabledReason}>{e.user.disabledReason.slice(0, 30)}...</p>}
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/employees/${e.id}`} className="btn-ghost btn-sm !p-1.5" title="View"><Eye size={13} /></Link>
                      <button onClick={() => makeIdCard(e)} className="btn-ghost btn-sm !p-1.5" title="Generate ID Card"><IdCard size={13} className="text-brand-600" /></button>
                      {canManage && (
                        <button onClick={() => openToggle(e)} className="btn-ghost btn-sm !p-1.5" title={e.user.isActive ? 'Disable' : 'Enable'}>
                          {e.user.isActive ? <UserX size={13} className="text-red-600" /> : <UserCheck size={13} className="text-green-600" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100">
          <Pagination page={page} totalPages={Math.ceil(total / 20)} onChange={setPage} />
        </div>
      </div>

      {/* Add Employee (limited fields — user completes profile later) */}
      <Modal open={modal === 'add'} onClose={() => setModal('none')} title="Add New Employee">
        <div className="space-y-4">
          <div className="bg-brand-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-semibold mb-1">👋 Quick setup</p>
            <p>Fill in the basics below. Employee ID will auto-generate (HBS format). The employee will fill in personal, ID, bank, and other details themselves after first login via their Profile page.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full Name *" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
            <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
            <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
            <Input label="Password *" type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="min 6 chars" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role" value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))} options={ROLES.map(r => ({ value: r, label: r.replace(/_/g, ' ') }))} />
            
            <Select label="Department" value={form.departmentId} onChange={e => setForm(p => ({...p, departmentId: e.target.value}))} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
            <Input label="Position" value={form.position} onChange={e => setForm(p => ({...p, position: e.target.value}))} placeholder="e.g. Junior Developer" />
            <Input label="Monthly Salary" type="number" value={form.salary} onChange={e => setForm(p => ({...p, salary: e.target.value}))} placeholder="25000" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Work Mode" value={form.workMode} onChange={e => setForm(p => ({...p, workMode: e.target.value}))} options={WORK_MODES.map(w => ({ value: w, label: w }))} />
            <Input label="Joining Date" type="date" value={form.joiningDate} onChange={e => setForm(p => ({...p, joiningDate: e.target.value}))} />
            <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({...p, dateOfBirth: e.target.value}))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button onClick={create} loading={saving}>Create Employee</Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Status */}
      <Modal open={modal === 'toggle'} onClose={() => setModal('none')} title={target?.user.isActive ? 'Disable Account' : 'Enable Account'}>
        <div className="space-y-4">
          <div className={`rounded-lg p-3 text-sm ${target?.user.isActive ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <p className="font-semibold">{target?.user.name} ({target?.employeeId})</p>
            <p className={`text-xs mt-1 ${target?.user.isActive ? 'text-red-700' : 'text-green-700'}`}>
              {target?.user.isActive ? '⚠️ This user will no longer be able to log in.' : '✅ This user will regain access.'}
            </p>
          </div>
          {target?.user.isActive && (
            <Input label="Reason (required)" value={toggleReason} onChange={e => setToggleReason(e.target.value)}
              placeholder="e.g. Left the company on 30 June 2026" />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal('none')}>Cancel</Button>
            <Button variant={target?.user.isActive ? 'danger' : 'primary'} onClick={toggleStatus} loading={saving}>
              {target?.user.isActive ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
