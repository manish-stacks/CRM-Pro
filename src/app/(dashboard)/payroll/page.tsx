'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button, Badge, Modal, Input, Select, EmptyState, Pagination, SearchInput } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DollarSign, Plus, Download, Edit, Trash2, Zap, Filter, X } from 'lucide-react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

export default function PayrollPage() {
  const { isAtLeast } = useAuth()
  const [payslips, setPayslips] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({ month: '', year: '', departmentId: '', status: '' })
  const [showGenModal, setShowGenModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [genForm, setGenForm] = useState({ month: String(new Date().getMonth() + 1), year: String(new Date().getFullYear()), departmentId: '' })
  const [editForm, setEditForm] = useState({ allowances: '', deductions: '', status: '', notes: '' })

  const fetchPayslips = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) })
      const r = await api.get(`/payroll?${params}`)
      setPayslips(r.data.data || [])
      setTotal(r.data.total || 0)
    } finally { setLoading(false) }
  }, [page, search, filters])

  useEffect(() => { fetchPayslips() }, [fetchPayslips])
  useEffect(() => {
    api.get('/employees?limit=200').then(r => setEmployees(r.data.data || [])).catch(()=>{})
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(()=>{})
  }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const r = await api.post('/payroll/generate', genForm)
      toast.success(`Generated ${r.data.data?.count || ''} payslips!`)
      setShowGenModal(false)
      fetchPayslips()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setGenerating(false) }
  }

  const openEdit = (ps: any) => {
    setEditing(ps)
    setEditForm({ allowances: String(ps.otherEarnings || 0), deductions: String(ps.otherDeduct || 0), status: ps.status, notes: '' })
    setShowEditModal(true)
  }

  const saveEdit = async () => {
    try {
      await api.put(`/payroll/${editing.id}`, { allowances: Number(editForm.allowances), deductions: Number(editForm.deductions), status: editForm.status })
      toast.success('Updated!')
      setShowEditModal(false)
      fetchPayslips()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this payslip?')) return
    await api.delete(`/payroll/${id}`)
    toast.success('Deleted')
    fetchPayslips()
  }

  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2].map(y => ({ value: String(y), label: String(y) }))
  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ]

  // Payslip has no `allowances`/`deductions` columns — these total the actual
  // schema fields (hra+conveyance+medical+specialAllow+otherEarnings for earnings on
  // top of basic; pf+esi+tds+professionTax+otherDeduct for deductions).
  const totalAllowances = (ps: any) => (ps.hra || 0) + (ps.conveyance || 0) + (ps.medical || 0) + (ps.specialAllow || 0) + (ps.otherEarnings || 0)
  const totalDeductions = (ps: any) => (ps.totalDeduct || 0) + (ps.otherDeduct || 0)

  const totalPayroll = payslips.reduce((s, p) => s + (p.netSalary || 0), 0)

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="text-sm text-gray-500">{total} payslips · Total: {formatCurrency(totalPayroll)}</p>
        </div>
        {isAtLeast('ADMIN') && (
          <Button variant="primary" onClick={() => setShowGenModal(true)}>
            <Zap size={15} />Generate Payroll
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Employee name..." />
        <Button variant="secondary" size="sm" onClick={() => setShowFilter(!showFilter)}><Filter size={14} />Filter</Button>
        {Object.values(filters).some(Boolean) && <Button variant="ghost" size="sm" onClick={() => setFilters({ month: '', year: '', departmentId: '', status: '' })}><X size={13} />Clear</Button>}
      </div>

      {showFilter && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select label="Month" value={filters.month} onChange={e => setFilters(p => ({ ...p, month: e.target.value }))} options={[{ value: '', label: 'All Months' }, ...months]} />
          <Select label="Year" value={filters.year} onChange={e => setFilters(p => ({ ...p, year: e.target.value }))} options={[{ value: '', label: 'All Years' }, ...years]} />
          <Select label="Department" value={filters.departmentId} onChange={e => setFilters(p => ({ ...p, departmentId: e.target.value }))} options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
          <Select label="Status" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} options={[{ value: '', label: 'All Status' }, { value: 'PENDING', label: 'Pending' }, { value: 'PAID', label: 'Paid' }]} />
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Period</th><th>Basic</th><th>Allowances</th><th>Deductions</th><th>Net Salary</th><th>Present/Working</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : payslips.length === 0 ? (
              <tr><td colSpan={9}><EmptyState title="No payslips" description="Generate payroll to see payslips" icon={<DollarSign size={24} />} /></td></tr>
            ) : payslips.map((ps: any) => (
              <tr key={ps.id}>
                <td>
                  <div className="font-medium text-gray-900">{ps.employee?.user?.name}</div>
                  <div className="text-xs text-gray-400">{ps.employee?.employeeId} · {ps.employee?.department?.name || '—'}</div>
                </td>
                <td className="text-sm text-gray-700">{months.find(m => m.value === String(ps.month))?.label} {ps.year}</td>
                <td className="text-sm">{formatCurrency(ps.basicSalary)}</td>
                <td className="text-sm text-green-600">+{formatCurrency(totalAllowances(ps))}</td>
                <td className="text-sm text-red-500">-{formatCurrency(totalDeductions(ps))}</td>
                <td className="font-bold text-gray-900">{formatCurrency(ps.netSalary)}</td>
                <td className="text-sm text-gray-600">{ps.presentDays}/{ps.workingDays}</td>
                <td>
                  <Badge status={ps.status} />
                </td>
                <td>
                  <div className="flex gap-1">
                    {isAtLeast('ADMIN') && <Button variant="ghost" size="sm" className="p-1.5" onClick={() => openEdit(ps)}><Edit size={13} /></Button>}
                    {isAtLeast('ADMIN') && <Button variant="danger" size="sm" className="p-1.5" onClick={() => del(ps.id)}><Trash2 size={13} /></Button>}
                    <Button variant="ghost" size="sm" className="p-1.5" onClick={() => window.open(`/api/payroll/${ps.id}/pdf`, '_blank')}><Download size={13} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / 20)} onPageChange={setPage} />

      {/* Generate Modal */}
      <Modal open={showGenModal} onClose={() => setShowGenModal(false)} title="Generate Payroll" className="max-w-md">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            This will calculate payroll based on attendance for each employee. Existing payslips for the same month won't be overwritten.
          </div>
          <div className="form-grid">
            <Select label="Month" value={genForm.month} onChange={e => setGenForm(p => ({ ...p, month: e.target.value }))} options={months} />
            <Select label="Year" value={genForm.year} onChange={e => setGenForm(p => ({ ...p, year: e.target.value }))} options={years} />
          </div>
          <Select label="Department (optional)" value={genForm.departmentId} onChange={e => setGenForm(p => ({ ...p, departmentId: e.target.value }))} options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowGenModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={generate} loading={generating}><Zap size={14} />Generate</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Payslip" className="max-w-md">
        {editing && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{editing.employee?.user?.name}</p>
              <p className="text-sm text-gray-500">Basic: {formatCurrency(editing.basicSalary)} · Gross: {formatCurrency(editing.grossSalary)} · Statutory deductions: {formatCurrency(editing.totalDeduct)}</p>
            </div>
            <div className="form-grid">
              <Input label="Other Earnings / Bonus (₹)" type="number" value={editForm.allowances} onChange={e => setEditForm(p => ({ ...p, allowances: e.target.value }))} />
              <Input label="Other Deductions (₹)" type="number" value={editForm.deductions} onChange={e => setEditForm(p => ({ ...p, deductions: e.target.value }))} />
            </div>
            <Select label="Status" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} options={[{ value: 'PENDING', label: 'Pending' }, { value: 'PAID', label: 'Paid' }]} />
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-sm text-gray-500">Net Salary</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(editing.grossSalary + Number(editForm.allowances || 0) - editing.totalDeduct - Number(editForm.deductions || 0))}</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit}>Update</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}