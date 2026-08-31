'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button, Badge, Modal, Input, Select, EmptyState, Pagination, SearchInput } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DollarSign, Plus, Download, Edit, Trash2, Zap, Filter, X, CalendarOff, Settings2 } from 'lucide-react'
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
  const [genForm, setGenForm] = useState({
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    departmentId: ''
  })
  const [editForm, setEditForm] = useState({
    allowances: '',
    deductions: '',
    status: '',
    notes: ''
  })

  // ---- LOP policy + company holidays (office-closed days) ----
  // Holidays and weekly-offs are never deducted. Anything beyond the monthly
  // paid-leave quota IS deducted, and every N late marks costs half a day.
  const [holidays, setHolidays] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState('')
  const [policy, setPolicy] = useState({
    paidLeaves: '1',
    latesPerHalfDay: '4'
  })
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [showHolidayModal, setShowHolidayModal] = useState(false)

  // Bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchPayslips = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v)
        )
      })

      const r = await api.get(`/payroll?${params}`)
      setPayslips(r.data.data || [])
      setTotal(r.data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, search, filters])

  useEffect(() => {
    fetchPayslips()
    setSelectedIds([])
  }, [fetchPayslips])

  useEffect(() => {
    api.get('/employees?limit=200')
      .then(r => setEmployees(r.data.data || []))
      .catch(() => { })

    api.get('/departments')
      .then(r => setDepartments(r.data.data || []))
      .catch(() => { })

    api.get('/settings')
      .then(r => {
        const g = r.data.data?.grouped || {}
        const all = {
          ...(g.payroll || {}),
          ...(g.hrm || {}),
          ...(g.general || {}),
          ...(g.company || {})
        }

        setHolidays(
          Array.isArray(all.company_holidays)
            ? all.company_holidays
            : []
        )

        setPolicy({
          paidLeaves: String(all.payroll_paid_leaves_per_month ?? 1),
          latesPerHalfDay: String(all.payroll_lates_per_halfday ?? 4),
        })
      })
      .catch(() => { })
  }, [])

  const savePolicy = async (nextHolidays?: string[]) => {
    const list = nextHolidays ?? holidays
    setSavingPolicy(true)

    try {
      await api.put('/settings', {
        settings: {
          company_holidays: {
            value: list,
            category: 'payroll'
          },
          payroll_paid_leaves_per_month: {
            value: Number(policy.paidLeaves) || 0,
            category: 'payroll'
          },
          payroll_lates_per_halfday: {
            value: Number(policy.latesPerHalfDay) || 0,
            category: 'payroll'
          },
        },
      })

      toast.success('LOP policy saved')
    } catch (e: any) {
      toast.error(
        e.response?.data?.error || 'Failed to save policy'
      )
    } finally {
      setSavingPolicy(false)
    }
  }

  // Holidays that fall inside a given month, for the
  // "N in the selected month" hint on the Generate modal.
  const holidaysInMonth = (m: string, y: string) => {
    const prefix = `${y}-${String(m).padStart(2, '0')}`
    return holidays.filter(h => h.startsWith(prefix))
  }

  const addHoliday = () => {
    if (!newHoliday) return

    if (holidays.includes(newHoliday)) {
      toast.error('Already added')
      return
    }

    const list = [...holidays, newHoliday].sort()
    setHolidays(list)
    setNewHoliday('')
    savePolicy(list)
  }

  const removeHoliday = (d: string) => {
    const list = holidays.filter(h => h !== d)
    setHolidays(list)
    savePolicy(list)
  }

  const generate = async () => {
    setGenerating(true)

    try {
      const r = await api.post('/payroll/generate', genForm)
      const d = r.data.data || {}

      toast.success(
        `Generated ${d.count || 0} payslips · ` +
        `${d.workingDays || 0} working days · ` +
        `${(d.holidays || []).length} holiday(s) excluded`
      )

      setShowGenModal(false)
      fetchPayslips()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally {
      setGenerating(false)
    }
  }

  const openEdit = (ps: any) => {
    setEditing(ps)

    setEditForm({
      allowances: String(ps.otherEarnings || 0),
      deductions: String(ps.otherDeduct || 0),
      status: ps.status,
      notes: ''
    })

    setShowEditModal(true)
  }

  const saveEdit = async () => {
    try {
      await api.put(`/payroll/${editing.id}`, {
        allowances: Number(editForm.allowances),
        deductions: Number(editForm.deductions),
        status: editForm.status
      })

      toast.success('Updated!')
      setShowEditModal(false)
      fetchPayslips()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    }
  }

  // ---- Delete (single + bulk) ----
  const toggleSelect = (id: string) =>
    setSelectedIds(p =>
      p.includes(id)
        ? p.filter(x => x !== id)
        : [...p, id]
    )

  const toggleSelectAll = () =>
    setSelectedIds(p =>
      p.length === payslips.length
        ? []
        : payslips.map((x: any) => x.id)
    )

  const deleteIds = async (ids: string[]) => {
    if (ids.length === 0) return

    const label =
      ids.length === 1
        ? 'this payslip'
        : `these ${ids.length} payslips`

    if (
      !confirm(
        `Delete ${label}? This cannot be undone.\n\n` +
        `Payslips already marked PAID will be skipped.`
      )
    ) return

    setBulkDeleting(true)

    try {
      const r = await api.delete('/payroll', {
        data: { ids }
      })

      const d = r.data.data || {}

      toast.success(
        `${d.deleted || 0} payslip(s) deleted` +
        (d.skippedPaid
          ? ` · ${d.skippedPaid} skipped (already PAID)`
          : '')
      )

      setSelectedIds(p =>
        p.filter(id => !ids.includes(id))
      )

      fetchPayslips()
    } catch (e: any) {
      toast.error(
        e.response?.data?.error || 'Delete failed'
      )
    } finally {
      setBulkDeleting(false)
    }
  }

  const del = (id: string) => deleteIds([id])
  const deleteSelected = () => deleteIds(selectedIds)

  const currentYear = new Date().getFullYear()

  const years = [
    currentYear,
    currentYear - 1,
    currentYear - 2
  ].map(y => ({
    value: String(y),
    label: String(y)
  }))

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]

  // Payslip has no `allowances`/`deductions` columns — these total the actual
  // schema fields (hra+conveyance+medical+specialAllow+otherEarnings for earnings on
  // top of basic; pf+esi+tds+professionTax+otherDeduct for deductions).
  const totalAllowances = (ps: any) =>
    (ps.hra || 0) +
    (ps.conveyance || 0) +
    (ps.medical || 0) +
    (ps.specialAllow || 0) +
    (ps.otherEarnings || 0)

  const totalDeductions = (ps: any) =>
    (ps.totalDeduct || 0) +
    (ps.otherDeduct || 0)

  const totalPayroll = payslips.reduce(
    (s, p) => s + (p.netSalary || 0),
    0
  )

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="text-sm text-gray-500">
            {total} payslips · Total: {formatCurrency(totalPayroll)}
          </p>
        </div>

        {isAtLeast('ADMIN') && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.length > 0 && (
              <Button
                variant="danger"
                onClick={deleteSelected}
                loading={bulkDeleting}
              >
                <Trash2 size={14} />
                Delete ({selectedIds.length})
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => setShowHolidayModal(true)}
            >
              <CalendarOff size={14} />
              Holidays &amp; LOP Policy

              {holidays.length > 0 && (
                <span className="ml-1 bg-emerald-100 text-emerald-700 rounded-full px-1.5 text-xs font-semibold">
                  {holidays.length}
                </span>
              )}
            </Button>

            <Button
              variant="primary"
              onClick={() => setShowGenModal(true)}
            >
              <Zap size={15} />
              Generate Payroll
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput
          value={search}
          onChange={v => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Employee name..."
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilter(!showFilter)}
        >
          <Filter size={14} />
          Filter
        </Button>

        {Object.values(filters).some(Boolean) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                month: '',
                year: '',
                departmentId: '',
                status: ''
              })
            }
          >
            <X size={13} />
            Clear
          </Button>
        )}
      </div>

      {showFilter && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            label="Month"
            value={filters.month}
            onChange={e =>
              setFilters(p => ({
                ...p,
                month: e.target.value
              }))
            }
            options={[
              { value: '', label: 'All Months' },
              ...months
            ]}
          />

          <Select
            label="Year"
            value={filters.year}
            onChange={e =>
              setFilters(p => ({
                ...p,
                year: e.target.value
              }))
            }
            options={[
              { value: '', label: 'All Years' },
              ...years
            ]}
          />

          <Select
            label="Department"
            value={filters.departmentId}
            onChange={e =>
              setFilters(p => ({
                ...p,
                departmentId: e.target.value
              }))
            }
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map(d => ({
                value: d.id,
                label: d.name
              }))
            ]}
          />

          <Select
            label="Status"
            value={filters.status}
            onChange={e =>
              setFilters(p => ({
                ...p,
                status: e.target.value
              }))
            }
            options={[
              { value: '', label: 'All Status' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'PAID', label: 'Paid' }
            ]}
          />
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {isAtLeast('ADMIN') && (
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={
                      payslips.length > 0 &&
                      selectedIds.length === payslips.length
                    }
                    onChange={toggleSelectAll}
                    title="Select all on this page"
                  />
                </th>
              )}

              <th>Employee</th>
              <th>Period</th>
              <th>Basic</th>
              <th>Allowances</th>
              <th>Deductions</th>
              <th>Net Salary</th>
              <th>Present/Working</th>
              <th>LOP</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({
                    length: isAtLeast('ADMIN') ? 11 : 10
                  }).map((_, j) => (
                    <td key={j}>
                      <div className="skeleton h-4 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : payslips.length === 0 ? (
              <tr>
                <td colSpan={isAtLeast('ADMIN') ? 11 : 10}>
                  <EmptyState
                    title="No payslips"
                    description="Generate payroll to see payslips"
                    icon={<DollarSign size={24} />}
                  />
                </td>
              </tr>
            ) : (
              payslips.map((ps: any) => (
                <tr
                  key={ps.id}
                  className={
                    selectedIds.includes(ps.id)
                      ? 'bg-brand-50/50'
                      : ''
                  }
                >
                  {isAtLeast('ADMIN') && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(ps.id)}
                        onChange={() =>
                          toggleSelect(ps.id)
                        }
                      />
                    </td>
                  )}

                  <td>
                    <div className="font-medium text-gray-900">
                      {ps.employee?.user?.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {ps.employee?.employeeId} ·{' '}
                      {ps.employee?.department?.name || '—'}
                    </div>
                  </td>

                  <td className="text-sm text-gray-700">
                    {
                      months.find(
                        m =>
                          m.value === String(ps.month)
                      )?.label
                    }{' '}
                    {ps.year}
                  </td>

                  <td className="text-sm">
                    {formatCurrency(ps.basicSalary)}
                  </td>

                  <td className="text-sm text-green-600">
                    +{formatCurrency(totalAllowances(ps))}
                  </td>

                  <td className="text-sm text-red-500">
                    -{formatCurrency(totalDeductions(ps))}
                  </td>

                  <td className="font-bold text-gray-900">
                    {formatCurrency(ps.netSalary)}
                  </td>

                  <td className="text-sm text-gray-600">
                    {ps.presentDays}/{ps.workingDays}

                    {ps.halfDays > 0 && (
                      <span className="text-xs text-amber-600">
                        {' '}
                        · {ps.halfDays} half
                      </span>
                    )}

                    {ps.leaveDays > 0 && (
                      <span className="text-xs text-blue-600">
                        {' '}
                        · {ps.leaveDays} leave
                      </span>
                    )}
                  </td>

                  <td
                    className="text-sm"
                    title={ps.notes || ''}
                  >
                    {ps.lopDays > 0 ? (
                      <span className="badge bg-red-100 text-red-700">
                        {ps.lopDays} d
                      </span>
                    ) : (
                      <span className="text-gray-300">
                        —
                      </span>
                    )}
                  </td>

                  <td>
                    <Badge status={ps.status} />
                  </td>

                  <td>
                    <div className="flex gap-1">
                      {isAtLeast('ADMIN') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5"
                          onClick={() => openEdit(ps)}
                        >
                          <Edit size={13} />
                        </Button>
                      )}

                      {isAtLeast('ADMIN') && (
                        <Button
                          variant="danger"
                          size="sm"
                          className="p-1.5"
                          onClick={() => del(ps.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5"
                        onClick={() =>
                          window.open(
                            `/api/payroll/${ps.id}/pdf`,
                            '_blank'
                          )
                        }
                      >
                        <Download size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / 20)}
        onPageChange={setPage}
      />

      {/* Generate Modal */}
      <Modal
        open={showGenModal}
        onClose={() => setShowGenModal(false)}
        title="Generate Payroll"
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="bg-brand-50 rounded-xl p-4 text-xs text-brand-700 space-y-1">
            <p className="font-semibold text-sm">
              How salary is calculated
            </p>

            <p>
              Working days = calendar days − weekly offs −
              company holidays below. Holidays and weekly offs
              are <b>never</b> deducted.
            </p>

            <p>
              LOP (deducted) = absent days + leaves beyond the
              paid quota + half days (0.5 each) + late marks.
            </p>

            <p>
              Running it for the current month only counts days
              up to today. Re-running overwrites that month's
              payslips.
            </p>
          </div>

          <div className="border border-gray-200 rounded-xl p-3 flex items-start justify-between gap-3">
            <div className="text-xs text-gray-600 space-y-0.5">
              <p>
                <b>{holidays.length}</b> company holiday(s)
                saved
                {genForm.month && genForm.year
                  ? ` · ${holidaysInMonth(
                    genForm.month,
                    genForm.year
                  ).length
                  } in the selected month`
                  : ''}
              </p>

              <p>
                <b>{policy.paidLeaves}</b> paid leave(s)/month
                · <b>{policy.latesPerHalfDay}</b> late marks = 1
                half day
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHolidayModal(true)}
            >
              <Settings2 size={13} />
              Manage
            </Button>
          </div>

          <div className="form-grid">
            <Select
              label="Month"
              value={genForm.month}
              onChange={e =>
                setGenForm(p => ({
                  ...p,
                  month: e.target.value
                }))
              }
              options={months}
            />

            <Select
              label="Year"
              value={genForm.year}
              onChange={e =>
                setGenForm(p => ({
                  ...p,
                  year: e.target.value
                }))
              }
              options={years}
            />
          </div>

          <Select
            label="Department (optional)"
            value={genForm.departmentId}
            onChange={e =>
              setGenForm(p => ({
                ...p,
                departmentId: e.target.value
              }))
            }
            options={[
              {
                value: '',
                label: 'All Departments'
              },
              ...departments.map(d => ({
                value: d.id,
                label: d.name
              }))
            ]}
          />

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowGenModal(false)}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={generate}
              loading={generating}
            >
              <Zap size={14} />
              Generate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Holidays & LOP Policy Modal */}
      <Modal
        open={showHolidayModal}
        onClose={() => setShowHolidayModal(false)}
        title="Holidays & LOP Policy"
        className="!max-w-lg"
      >
        <div className="space-y-5">
          <div className="bg-brand-50 rounded-xl p-3 text-xs text-brand-700 space-y-1">
            <p className="font-semibold text-sm">
              These settings apply to the entire company
            </p>

            <p>
              Dates added here are excluded from the working day
              count — salary is never deducted for these days.
              Weekly offs are configured separately under
              Settings → HRM.
            </p>

            <p>
              Add the holidays for the month <b>before</b>
              generating payroll. If you add them later, you
              will need to generate payroll for that month again.
            </p>
          </div>

          {/* ---- Add a holiday ---- */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Company holidays / office closed days
            </p>

            <div className="flex gap-2">
              <input
                type="date"
                className="input text-sm flex-1"
                value={newHoliday}
                onChange={e =>
                  setNewHoliday(e.target.value)
                }
              />

              <Button
                variant="primary"
                size="sm"
                onClick={addHoliday}
                loading={savingPolicy}
              >
                <Plus size={13} />
                Add
              </Button>
            </div>

            {holidays.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No holidays have been added yet — every day
                will be counted as a working day.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-3 pt-1">
                {Object.entries(
                  holidays.reduce(
                    (
                      acc: Record<string, string[]>,
                      h
                    ) => {
                      const key = h.slice(0, 7)
                        ; (acc[key] =
                          acc[key] || []).push(h)
                      return acc
                    },
                    {}
                  )
                )
                  .sort(([a], [b]) =>
                    a.localeCompare(b)
                  )
                  .map(([ym, list]) => {
                    const [yy, mm] = ym.split('-')

                    return (
                      <div key={ym}>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                          {
                            months.find(
                              m =>
                                m.value ===
                                String(Number(mm))
                            )?.label
                          }{' '}
                          {yy}

                          <span className="ml-1 font-normal normal-case">
                            ({list.length})
                          </span>
                        </p>

                        <div className="space-y-1">
                          {list.sort().map(h => (
                            <div
                              key={h}
                              className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5"
                            >
                              <span className="text-sm text-emerald-900">
                                {new Date(
                                  h + 'T00:00:00'
                                ).toLocaleDateString(
                                  'en-IN',
                                  {
                                    weekday: 'short',
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  }
                                )}
                              </span>

                              <button
                                onClick={() =>
                                  removeHoliday(h)
                                }
                                className="text-emerald-700 hover:text-red-600"
                                title="Remove"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* ---- LOP policy ---- */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              LOP policy
            </p>

            <div className="form-grid">
              <Input
                label="Paid leaves per month"
                type="number"
                value={policy.paidLeaves}
                onChange={e =>
                  setPolicy(p => ({
                    ...p,
                    paidLeaves: e.target.value
                  }))
                }
              />

              <Input
                label="Late marks = 1 half day"
                type="number"
                value={policy.latesPerHalfDay}
                onChange={e =>
                  setPolicy(p => ({
                    ...p,
                    latesPerHalfDay: e.target.value
                  }))
                }
              />
            </div>

            <p className="text-[11px] text-gray-500">
              Leave beyond this quota counts as LOP and is
              deducted from salary. Every{' '}
              {policy.latesPerHalfDay || 4} late punch-ins
              result in a half-day deduction.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => setShowHolidayModal(false)}
            >
              Close
            </Button>

            <Button
              variant="primary"
              onClick={() => savePolicy()}
              loading={savingPolicy}
            >
              Save policy
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Payslip"
        className="max-w-md"
      >
        {editing && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-900">
                {editing.employee?.user?.name}
              </p>

              <p className="text-sm text-gray-500">
                Basic: {formatCurrency(editing.basicSalary)} ·
                Gross: {formatCurrency(editing.grossSalary)} ·
                Statutory deductions:{' '}
                {formatCurrency(editing.totalDeduct)}
              </p>
            </div>

            <div className="form-grid">
              <Input
                label="Other Earnings / Bonus (₹)"
                type="number"
                value={editForm.allowances}
                onChange={e =>
                  setEditForm(p => ({
                    ...p,
                    allowances: e.target.value
                  }))
                }
              />

              <Input
                label="Other Deductions (₹)"
                type="number"
                value={editForm.deductions}
                onChange={e =>
                  setEditForm(p => ({
                    ...p,
                    deductions: e.target.value
                  }))
                }
              />
            </div>

            <Select
              label="Status"
              value={editForm.status}
              onChange={e =>
                setEditForm(p => ({
                  ...p,
                  status: e.target.value
                }))
              }
              options={[
                {
                  value: 'PENDING',
                  label: 'Pending'
                },
                {
                  value: 'PAID',
                  label: 'Paid'
                }
              ]}
            />

            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-sm text-gray-500">
                Net Salary
              </p>

              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  editing.grossSalary +
                  Number(editForm.allowances || 0) -
                  editing.totalDeduct -
                  Number(editForm.deductions || 0)
                )}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                onClick={saveEdit}
              >
                Update
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
