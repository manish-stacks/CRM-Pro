'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button, Select, Input, Modal, EmptyState, Pagination, SearchInput } from '@/components/ui'
import { FileText, Download, Trash2, Plus, Filter, X, Briefcase, TrendingUp, LogOut as RelieveIcon, Mail } from 'lucide-react'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

type LetterType = 'OFFER' | 'SALARY_REVISION' | 'RELIEVING_EXPERIENCE'

const LETTER_TABS: { value: LetterType; label: string; icon: any }[] = [
  { value: 'OFFER', label: 'Offer Letter', icon: Briefcase },
  { value: 'SALARY_REVISION', label: 'Salary Revision Letter', icon: TrendingUp },
  { value: 'RELIEVING_EXPERIENCE', label: 'Relieving & Experience Letter', icon: RelieveIcon },
]

const TYPE_LABEL: Record<string, string> = {
  OFFER: 'Offer Letter',
  SALARY_REVISION: 'Salary Revision',
  RELIEVING_EXPERIENCE: 'Relieving & Experience',
}

export default function LettersPage() {
  const { user, isAtLeast } = useAuth()

  // ---- list state (search / filter / pagination) ----
  const [letters, setLetters] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState({ type: '' })
  const LIMIT = 10

  // ---- modal / form state ----
  const [showModal, setShowModal] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<LetterType>('OFFER')
  const [employeeId, setEmployeeId] = useState('')

  const [offerForm, setOfferForm] = useState({
    relationPrefix: 'S/o', relativeName: '', address: '',
    designation: '', department: '', placeOfPosting: '',
    monthlySalary: '', joiningDate: '', reportingManagerName: '',
    probationMonths: '6', noticePeriodMonths: '1',
  })
  const [salaryForm, setSalaryForm] = useState({
    effectiveDate: '', previousSalary: '', revisedSalary: '',
    signatoryName: '', signatoryDesignation: 'HR Manager',
  })
  const [relievingForm, setRelievingForm] = useState({
    pronoun: 'He', fromDate: '', toDate: '',
    designation: '', department: '', placeOfPosting: '', fixedCTC: '', place: 'New Delhi',
  })

  const fetchLetters = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = { page: String(page), limit: String(LIMIT) }
      if (search) p.search = search
      if (filters.type) p.type = filters.type
      const r = await api.get(`/letters?${new URLSearchParams(p)}`)
      setLetters(r.data.data || [])
      setTotal(r.data.total || 0)
    } catch {
      toast.error('Failed to load letters')
    } finally {
      setLoading(false)
    }
  }, [page, search, filters])

  useEffect(() => { fetchLetters() }, [fetchLetters])
  useEffect(() => {
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data || [])).catch(() => {})
  }, [])

  // Auto-fill from the selected employee's existing record so the admin only
  // has to type what isn't already on file.
  useEffect(() => {
    if (!employeeId) return
    const emp = employees.find(e => e.id === employeeId)
    if (!emp) return
    setOfferForm(p => ({
      ...p,
      designation: emp.position || p.designation,
      department: emp.department?.name || p.department,
      monthlySalary: emp.salary ? String(emp.salary) : p.monthlySalary,
      joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB') : p.joiningDate,
    }))
    setSalaryForm(p => ({ ...p, previousSalary: emp.salary ? String(emp.salary) : p.previousSalary }))
    setRelievingForm(p => ({
      ...p,
      designation: emp.position || p.designation,
      department: emp.department?.name || p.department,
      fromDate: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-GB') : p.fromDate,
      fixedCTC: emp.salary ? String(emp.salary) : p.fixedCTC,
      pronoun: emp.gender === 'Female' ? 'She' : 'He',
    }))
  }, [employeeId, employees])

  if (!isAtLeast('ADMIN')) {
    return <EmptyState title="Admins only" description="This section is restricted to Admins." icon={<FileText size={24} />} />
  }

  const openCreate = () => {
    setEmployeeId('')
    setActiveTab('OFFER')
    setOfferForm({ relationPrefix: 'S/o', relativeName: '', address: '', designation: '', department: '', placeOfPosting: '', monthlySalary: '', joiningDate: '', reportingManagerName: '', probationMonths: '6', noticePeriodMonths: '1' })
    setSalaryForm({ effectiveDate: '', previousSalary: '', revisedSalary: '', signatoryName: '', signatoryDesignation: 'HR Manager' })
    setRelievingForm({ pronoun: 'He', fromDate: '', toDate: '', designation: '', department: '', placeOfPosting: '', fixedCTC: '', place: 'New Delhi' })
    setShowModal(true)
  }

  const generate = async () => {
    if (!employeeId) { toast.error('Select an employee first'); return }
    let fields: any = {}
    if (activeTab === 'OFFER') {
      if (!offerForm.designation || !offerForm.department || !offerForm.placeOfPosting || !offerForm.monthlySalary || !offerForm.joiningDate || !offerForm.reportingManagerName) {
        toast.error('Fill all required fields'); return
      }
      fields = { ...offerForm, monthlySalary: Number(offerForm.monthlySalary), probationMonths: Number(offerForm.probationMonths), noticePeriodMonths: Number(offerForm.noticePeriodMonths) }
    } else if (activeTab === 'SALARY_REVISION') {
      if (!salaryForm.effectiveDate || !salaryForm.previousSalary || !salaryForm.revisedSalary) {
        toast.error('Fill all required fields'); return
      }
      fields = { ...salaryForm, previousSalary: Number(salaryForm.previousSalary), revisedSalary: Number(salaryForm.revisedSalary), signatoryName: salaryForm.signatoryName || user?.name }
    } else {
      if (!relievingForm.fromDate || !relievingForm.toDate || !relievingForm.designation || !relievingForm.department || !relievingForm.placeOfPosting || !relievingForm.fixedCTC) {
        toast.error('Fill all required fields'); return
      }
      fields = { ...relievingForm, fixedCTC: Number(relievingForm.fixedCTC), possessivePronoun: relievingForm.pronoun === 'She' ? 'Her' : 'His', salutation: relievingForm.pronoun === 'She' ? 'Ms.' : 'Mr.' }
    }

    setGenerating(true)
    try {
      const res = await api.post('/letters', { employeeId, type: activeTab, fields })
      const id = res.data.data.id
      window.open(`/api/letters/${id}/pdf`, '_blank')
      toast.success('Letter generated')
      setShowModal(false)
      setPage(1)
      fetchLetters()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to generate letter')
    } finally {
      setGenerating(false)
    }
  }

  const removeLetter = async (id: string) => {
    if (!confirm('Delete this letter record?')) return
    try {
      await api.delete(`/letters/${id}`)
      toast.success('Deleted')
      fetchLetters()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const [sendingId, setSendingId] = useState<string | null>(null)
  const sendLetterEmail = async (l: any) => {
    const email = l.employee?.user?.email
    if (!confirm(`Send this letter to ${email || 'the employee'} by email?`)) return
    setSendingId(l.id)
    try {
      await api.post(`/letters/${l.id}/send`)
      toast.success(`Emailed to ${email}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send email')
    } finally {
      setSendingId(null)
    }
  }

  const employeeOptions = [{ value: '', label: 'Select employee...' }, ...employees.map(e => ({ value: e.id, label: `${e.user?.name} (${e.employeeId})` }))]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">HR Letters</h1>
          <p className="text-sm text-gray-500">{total} letters generated</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus size={15} />Generate Letter
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder="Employee name, email or ID..." />
        <Button variant="secondary" size="sm" onClick={() => setShowFilter(!showFilter)}><Filter size={14} />Filter</Button>
        {filters.type && <Button variant="ghost" size="sm" onClick={() => { setFilters({ type: '' }); setPage(1) }}><X size={13} />Clear</Button>}
      </div>

      {showFilter && (
        <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select
            label="Letter Type"
            value={filters.type}
            onChange={e => { setFilters(p => ({ ...p, type: e.target.value })); setPage(1) }}
            options={[{ value: '', label: 'All Types' }, ...LETTER_TABS.map(t => ({ value: t.value, label: t.label }))]}
          />
        </div>
      )}

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Employee</th><th>Type</th><th>Generated By</th><th>Date</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : letters.length === 0 ? (
              <tr><td colSpan={5}><EmptyState title="No letters found" description="Generate your first letter to see it here" icon={<FileText size={24} />} /></td></tr>
            ) : letters.map(l => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium text-gray-900">{l.employee?.user?.name}</div>
                  <div className="text-xs text-gray-400">{l.employee?.employeeId} · {l.employee?.department?.name || '—'}</div>
                </td>
                <td><span className="badge bg-blue-100 text-blue-700">{TYPE_LABEL[l.type] || l.type}</span></td>
                <td>{l.generatedBy?.name || '—'}</td>
                <td>{new Date(l.createdAt).toLocaleDateString('en-GB')}</td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="p-1.5" onClick={() => window.open(`/api/letters/${l.id}/pdf`, '_blank')}><Download size={13} /></Button>
                    <Button variant="ghost" size="sm" className="p-1.5" loading={sendingId === l.id} onClick={() => sendLetterEmail(l)} title="Email to employee"><Mail size={13} className="text-blue-600" /></Button>
                    <Button variant="ghost" size="sm" className="p-1.5" onClick={() => removeLetter(l.id)}><Trash2 size={13} className="text-red-500" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / LIMIT))} onChange={setPage} />

      {/* Generate Letter modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Generate HR Letter" className="max-w-2xl">
        <div className="space-y-4">
          <Select label="Employee" value={employeeId} onChange={e => setEmployeeId(e.target.value)} options={employeeOptions} />

          <div className="flex gap-2 border-b border-gray-100 pb-2 flex-wrap">
            {LETTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                <tab.icon size={14} />{tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'OFFER' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select label="Relation" value={offerForm.relationPrefix} onChange={e => setOfferForm(p => ({ ...p, relationPrefix: e.target.value }))} options={[{ value: 'S/o', label: 'S/o' }, { value: 'D/o', label: 'D/o' }, { value: 'W/o', label: 'W/o' }]} />
              <Input label="Father's / Husband's Name" value={offerForm.relativeName} onChange={e => setOfferForm(p => ({ ...p, relativeName: e.target.value }))} />
              <Input label="Address" value={offerForm.address} onChange={e => setOfferForm(p => ({ ...p, address: e.target.value }))} className="md:col-span-2" />
              <Input label="Designation *" value={offerForm.designation} onChange={e => setOfferForm(p => ({ ...p, designation: e.target.value }))} />
              <Input label="Department *" value={offerForm.department} onChange={e => setOfferForm(p => ({ ...p, department: e.target.value }))} />
              <Input label="Place of Posting *" value={offerForm.placeOfPosting} onChange={e => setOfferForm(p => ({ ...p, placeOfPosting: e.target.value }))} placeholder="NSP, Delhi" />
              <Input label="Monthly Salary (₹) *" type="number" value={offerForm.monthlySalary} onChange={e => setOfferForm(p => ({ ...p, monthlySalary: e.target.value }))} />
              <Input label="Joining Date (w.e.f.) *" value={offerForm.joiningDate} onChange={e => setOfferForm(p => ({ ...p, joiningDate: e.target.value }))} placeholder="19th December 2023" />
              <Input label="Reporting Manager *" value={offerForm.reportingManagerName} onChange={e => setOfferForm(p => ({ ...p, reportingManagerName: e.target.value }))} />
              <Input label="Probation (months)" type="number" value={offerForm.probationMonths} onChange={e => setOfferForm(p => ({ ...p, probationMonths: e.target.value }))} />
              <Input label="Notice Period (months)" type="number" value={offerForm.noticePeriodMonths} onChange={e => setOfferForm(p => ({ ...p, noticePeriodMonths: e.target.value }))} />
            </div>
          )}

          {activeTab === 'SALARY_REVISION' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Effective Date *" value={salaryForm.effectiveDate} onChange={e => setSalaryForm(p => ({ ...p, effectiveDate: e.target.value }))} placeholder="1st August 2026" />
              <div />
              <Input label="Previous Salary (₹) *" type="number" value={salaryForm.previousSalary} onChange={e => setSalaryForm(p => ({ ...p, previousSalary: e.target.value }))} />
              <Input label="Revised Salary (₹) *" type="number" value={salaryForm.revisedSalary} onChange={e => setSalaryForm(p => ({ ...p, revisedSalary: e.target.value }))} />
              <Input label="Signed By" value={salaryForm.signatoryName} onChange={e => setSalaryForm(p => ({ ...p, signatoryName: e.target.value }))} placeholder={user?.name} />
              <Input label="Signatory Designation" value={salaryForm.signatoryDesignation} onChange={e => setSalaryForm(p => ({ ...p, signatoryDesignation: e.target.value }))} />
            </div>
          )}

          {activeTab === 'RELIEVING_EXPERIENCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select label="Pronoun" value={relievingForm.pronoun} onChange={e => setRelievingForm(p => ({ ...p, pronoun: e.target.value }))} options={[{ value: 'He', label: 'He / Him' }, { value: 'She', label: 'She / Her' }]} />
              <div />
              <Input label="From Date (Joining) *" value={relievingForm.fromDate} onChange={e => setRelievingForm(p => ({ ...p, fromDate: e.target.value }))} placeholder="25th December 2025" />
              <Input label="Last Working Date *" value={relievingForm.toDate} onChange={e => setRelievingForm(p => ({ ...p, toDate: e.target.value }))} placeholder="7th May 2026" />
              <Input label="Designation *" value={relievingForm.designation} onChange={e => setRelievingForm(p => ({ ...p, designation: e.target.value }))} />
              <Input label="Department *" value={relievingForm.department} onChange={e => setRelievingForm(p => ({ ...p, department: e.target.value }))} />
              <Input label="Place of Posting *" value={relievingForm.placeOfPosting} onChange={e => setRelievingForm(p => ({ ...p, placeOfPosting: e.target.value }))} />
              <Input label="Fixed CTC (₹/month) *" type="number" value={relievingForm.fixedCTC} onChange={e => setRelievingForm(p => ({ ...p, fixedCTC: e.target.value }))} />
              <Input label="Place (for signature line)" value={relievingForm.place} onChange={e => setRelievingForm(p => ({ ...p, place: e.target.value }))} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={generating} onClick={generate}>
              <FileText size={15} />Generate &amp; Open Letter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
