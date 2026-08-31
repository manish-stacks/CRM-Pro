'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button, Badge, Modal, Input, Select, Textarea, Pagination } from '@/components/ui'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { ArrowLeft, User, Briefcase, CreditCard, FileText, Phone, Mail, Building2, Calendar, MapPin, Shield, Droplets, HeartPulse, KeyRound, Camera, Monitor, Loader2, X, Clock, Trash2 } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

const WORK_MODES = ['WFO', 'WFH', 'HYBRID']
const GENDERS = ['MALE', 'FEMALE', 'OTHER']
const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE', 'TELECALLER', 'MARKETING_EXECUTIVE']
const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const ID_PROOF_TYPES = ['AADHAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID']

const emptyForm = {
  name: '', email: '', phone: '', altPhone: '', role: '',
  departmentId: '', reportingToId: '', position: '', salary: '', workMode: 'WFO', joiningDate: '', area: '',
  dateOfBirth: '', gender: '', bloodGroup: '', maritalStatus: '',
  fatherName: '', motherName: '',
  address: '', city: '', state: '', pincode: '',
  emergencyContact: '', emergencyPhone: '',
  panNumber: '', aadharNumber: '',
  idProofType: '', idProofNumber: '',
  bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '',
}

// Decimal hours (7.59 = 7h 35m) read as clock time by everyone, which is why
// the totals looked wrong. Render h/m; decimal stays in the tooltip.
const hm = (h?: number | null) => {
  if (h == null) return '—'
  const mins = Math.round(h * 60)
  const hrs = Math.floor(mins / 60)
  const m = mins % 60
  return hrs > 0 ? `${hrs}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isAtLeast, user } = useAuth()
  const [emp, setEmp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  // ---- Attendance tab: server-side filtering + pagination ----
  const ATT_LIMIT = 15
  const [att, setAtt] = useState<any[]>([])
  const [attTotal, setAttTotal] = useState(0)
  const [attPage, setAttPage] = useState(1)
  const [attLoading, setAttLoading] = useState(false)
  const [attFilters, setAttFilters] = useState({ month: '', status: '', workMode: '', late: '', dateFrom: '', dateTo: '' })
  const [attTotals, setAttTotals] = useState<any>(null)

  const fetchAttendance = useCallback(async () => {
    if (!id) return
    setAttLoading(true)
    try {
      const p: Record<string, string> = {
        employeeId: String(id), page: String(attPage), limit: String(ATT_LIMIT),
      }
      Object.entries(attFilters).forEach(([k, v]) => { if (v) p[k] = v })
      const r = await api.get(`/attendance?${new URLSearchParams(p)}`)
      setAtt(r.data.data || [])
      setAttTotal(r.data.total || 0)
      setAttTotals(r.data.totals || null)
    } catch {
      setAtt([]); setAttTotal(0); setAttTotals(null)
    } finally { setAttLoading(false) }
  }, [id, attPage, attFilters])

  useEffect(() => { if (tab === 'attendance') fetchAttendance() }, [tab, fetchAttendance])
  const setAttF = (patch: Record<string, string>) => { setAttFilters(p => ({ ...p, ...patch })); setAttPage(1) }

  const [departments, setDepartments] = useState<any[]>([])
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdForm, setPwdForm] = useState({ password: '', confirm: '', notify: true })

  const fetchEmp = () => {
    setLoading(true)
    return api.get(`/employees/${id}`).then(r => setEmp(r.data.data)).catch(() => router.push('/employees')).finally(() => setLoading(false))
  }

  useEffect(() => { fetchEmp() }, [id])

  const [balance, setBalance] = useState<any>(null)
  useEffect(() => {
    if (id) api.get(`/leaves/balance?employeeId=${id}`).then(r => setBalance(r.data.data)).catch(() => { })
  }, [id])

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
    api.get('/employees?role=MANAGER&limit=200').then(r => setAllEmployees(r.data.data || [])).catch(() => { })
  }, [])

  const toInputDate = (d: any) => d ? new Date(d).toISOString().split('T')[0] : ''


  const openEdit = () => {
    if (!emp) return
    setForm({
      name: emp.user.name || '', email: emp.user.email || '', phone: emp.user.phone || '', altPhone: emp.user.altPhone || '', role: emp.user.role || '',
      departmentId: emp.department?.id || '', reportingToId: emp.reportingToId || '', position: emp.position || '', salary: emp.salary || '',
      area: emp.area || '',
      workMode: emp.workMode || 'WFO', joiningDate: toInputDate(emp.joiningDate),
      dateOfBirth: toInputDate(emp.dateOfBirth), gender: emp.gender || '', bloodGroup: emp.bloodGroup || '',
      maritalStatus: emp.maritalStatus || '', fatherName: emp.fatherName || '', motherName: emp.motherName || '',
      address: emp.address || '', city: emp.city || '', state: emp.state || '', pincode: emp.pincode || '',
      emergencyContact: emp.emergencyContact || '', emergencyPhone: emp.emergencyPhone || '',
      panNumber: emp.panNumber || '', aadharNumber: emp.aadharNumber || '',
      idProofType: emp.idProofType || '', idProofNumber: emp.idProofNumber || '',
      bankName: emp.bankName || '', accountNumber: emp.accountNumber || '', ifscCode: emp.ifscCode || '',
      accountHolderName: emp.accountHolderName || '',
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await api.put(`/employees/${id}`, form)
      toast.success('Employee updated')
      setEditOpen(false)
      fetchEmp()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update')
    } finally { setSaving(false) }
  }

  const [trackerSaving, setTrackerSaving] = useState(false)
  const toggleTrackerExempt = async () => {
    setTrackerSaving(true)
    try {
      const next = !emp.trackerExempt
      await api.post(`/employees/${id}/toggle-tracker`, { trackerExempt: next })
      toast.success(next ? 'Desktop tracker se exempt kar diya' : 'Desktop tracker phir se enabled')
      fetchEmp()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update')
    } finally { setTrackerSaving(false) }
  }

  // On-demand screen view — request one screenshot from the employee's
  // desktop app right now, poll until it's fulfilled (or times out).
  const [screenshotOpen, setScreenshotOpen] = useState(false)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  // Screenshot history — recent ones only; the cron job auto-purges anything
  // older than a week (see /api/cron/screenshot-cleanup), so this is a
  // rolling window, not a permanent archive.
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [historyPreview, setHistoryPreview] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteScreenshot = async (screenshotId: string) => {
    if (!confirm('Delete this screenshot? This cannot be undone.')) return
    setDeletingId(screenshotId)
    try {
      await api.delete(`/tracker/screenshot-request/history?id=${screenshotId}`)
      setHistory(prev => prev.filter(h => h.id !== screenshotId))
    } catch {
      toast.error('Failed to delete screenshot')
    } finally { setDeletingId(null) }
  }

  const openHistory = async () => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const r = await api.get(`/tracker/screenshot-request/history?employeeId=${id}`)
      setHistory(r.data.data || [])
    } catch {
      toast.error('Failed to load screenshot history')
    } finally { setHistoryLoading(false) }
  }

  const requestScreenshot = async () => {
    setScreenshotOpen(true)
    setScreenshotLoading(true)
    setScreenshotUrl(null)
    setScreenshotError(null)
    try {
      const r = await api.post('/tracker/screenshot-request', { employeeId: id })
      const requestId = r.data.data.id
      const start = Date.now()
      const poll = async (): Promise<void> => {
        if (Date.now() - start > 35_000) {
          setScreenshotLoading(false)
          setScreenshotError('Timed out — the desktop app may be closed or offline right now.')
          return
        }
        const res = await api.get(`/tracker/screenshot-request/${requestId}`)
        const d = res.data.data
        if (d.status === 'FULFILLED') {
          setScreenshotLoading(false)
          setScreenshotUrl(d.imageUrl)
        } else if (d.status === 'EXPIRED' || d.status === 'FAILED') {
          setScreenshotLoading(false)
          setScreenshotError('Could not get a screenshot — the desktop app may be closed or offline right now.')
        } else {
          setTimeout(poll, 2000)
        }
      }
      poll()
    } catch (e: any) {
      setScreenshotLoading(false)
      setScreenshotError(e.response?.data?.error || 'Failed to request screenshot')
    }
  }

  const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$'
    let p = ''
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)]
    setPwdForm(f => ({ ...f, password: p, confirm: p }))
  }

  const savePassword = async () => {
    if (pwdForm.password.length < 6) return toast.error('Password must be at least 6 characters')
    if (pwdForm.password !== pwdForm.confirm) return toast.error('Passwords do not match')
    setPwdSaving(true)
    try {
      await api.post(`/employees/${id}/reset-password`, { password: pwdForm.password, notify: pwdForm.notify })
      toast.success('Password changed successfully')
      setPwdOpen(false)
      setPwdForm({ password: '', confirm: '', notify: true })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to change password')
    } finally { setPwdSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!emp) return null

  const TABS = ['overview', 'personal', 'documents', 'bank', 'attendance']

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value || '—'}</span>
    </div>
  )

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  // console.log('user', user)
  return (
    <div className="space-y-6 mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link href="/employees"><Button variant="ghost" size="sm"><ArrowLeft size={15} />Back</Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-2xl font-bold">
              {emp.user.avatar ? <img src={emp.user.avatar} className="w-full h-full object-cover rounded-md" /> : getInitials(emp.user.name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{emp.user.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">{emp.employeeId}</span>
                <span className="text-sm text-gray-500">{emp.position || emp.user.role.replace(/_/g, ' ')}</span>
                {emp.department && <span className="text-xs text-gray-400">· {emp.department.name}</span>}
                <Badge status={emp.user.isActive ? 'ACTIVE' : 'INACTIVE'} />
                {emp.trackerExempt && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Tracker Exempt</span>}
              </div>
            </div>
          </div>
        </div>
        {isAtLeast('ADMIN') && (
          <div className="flex gap-2">
            {
              user?.id === 'cmrdig055000kb9bozetvjdfv' && (
                <>
                  <Button variant="ghost" size="sm" onClick={requestScreenshot}>
                    <Monitor size={14} />View Screen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={openHistory}>
                    <Clock size={14} />Screen History
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleTrackerExempt} loading={trackerSaving}>
                    <Camera size={14} />{emp.trackerExempt ? 'Enable Tracker' : 'Exempt from Tracker'}
                  </Button>
                </>
              )
            }

            <Button variant="ghost" size="sm" onClick={() => setPwdOpen(true)}><KeyRound size={14} />Change Password</Button>
            <Button variant="primary" size="sm" onClick={openEdit}>Edit</Button>
          </div>
        )}
      </div>

      {/* Tab pills */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {balance && (
            <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-indigo-100 text-xs">Paid leave balance (auto carry-forward)</p>
                  <p className="text-3xl font-bold mt-0.5">{balance.available}</p>
                  <p className="text-indigo-100 text-xs mt-0.5">Max carry-forward {balance.maxCap} · {balance.monthlyAccrual}/month</p>
                </div>
                <div className="flex gap-5 text-center">
                  <div><p className="text-lg font-bold">{balance.accrued}</p><p className="text-[11px] text-indigo-100">Earned</p></div>
                  <div><p className="text-lg font-bold">{balance.taken}</p><p className="text-[11px] text-indigo-100">Taken</p></div>
                  {balance.lapsed > 0 && <div><p className="text-lg font-bold text-amber-200">{balance.lapsed}</p><p className="text-[11px] text-indigo-100">Lapsed</p></div>}
                </div>
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4"><Briefcase size={16} className="text-brand-600" /><h3 className="font-semibold text-gray-900">Work Details</h3></div>
              <InfoRow label="Role" value={emp.user.role.replace(/_/g, ' ')} />
              <InfoRow label="Position" value={emp.position} />
              <InfoRow label="Department" value={emp.department?.name} />
              {emp.area && <InfoRow label="Marketing Area" value={emp.area} />}
              <InfoRow label="Reports To (Team Lead)" value={emp.reportingTo?.user?.name} />
              <InfoRow label="Work Mode" value={emp.workMode} />
              <InfoRow label="Joining Date" value={emp.joiningDate ? formatDate(emp.joiningDate) : undefined} />
              <InfoRow label="Salary" value={emp.salary ? formatCurrency(emp.salary) : undefined} />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4"><User size={16} className="text-green-600" /><h3 className="font-semibold text-gray-900">Contact</h3></div>
              <InfoRow label="Email" value={emp.user.email} />
              <InfoRow label="Phone" value={emp.user.phone} />
              <InfoRow label="Address" value={emp.address} />
              <InfoRow label="City" value={emp.city} />
              <InfoRow label="State" value={emp.state} />
              <InfoRow label="Pincode" value={emp.pincode} />
            </div>
          </div>
        </div>
      )}

      {/* Personal */}
      {tab === 'personal' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><HeartPulse size={16} className="text-pink-500" /><h3 className="font-semibold text-gray-900">Personal Info</h3></div>
            <InfoRow label="Date of Birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : undefined} />
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Blood Group" value={emp.bloodGroup} />
            <InfoRow label="Marital Status" value={emp.maritalStatus} />
            <InfoRow label="Father's Name" value={emp.fatherName} />
            <InfoRow label="Mother's Name" value={emp.motherName} />
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><Shield size={16} className="text-orange-500" /><h3 className="font-semibold text-gray-900">Emergency Contact</h3></div>
            <InfoRow label="Name" value={emp.emergencyContact} />
            <InfoRow label="Phone" value={emp.emergencyPhone} />
          </div>
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && (
        <div className="card p-5 max-w-md">
          <div className="flex items-center gap-2 mb-4"><FileText size={16} className="text-indigo-600" /><h3 className="font-semibold text-gray-900">Identity Documents</h3></div>
          <InfoRow label="ID Type" value={emp.idProofType} />
          <InfoRow label="ID Number" value={emp.idProofNumber} />
          <InfoRow label="PAN Number" value={emp.panNumber} />
          <InfoRow label="Aadhar Number" value={emp.aadharNumber} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Aadhar Front</p>
              {emp.aadharFrontUrl ? (
                <a href={emp.aadharFrontUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={emp.aadharFrontUrl} alt="Aadhar Front" className="w-full aspect-video object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                </a>
              ) : (
                <div className="w-full aspect-video rounded-lg border border-dashed border-gray-200 grid place-items-center text-xs text-gray-400">Not uploaded</div>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Aadhar Back</p>
              {emp.aadharBackUrl ? (
                <a href={emp.aadharBackUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={emp.aadharBackUrl} alt="Aadhar Back" className="w-full aspect-video object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                </a>
              ) : (
                <div className="w-full aspect-video rounded-lg border border-dashed border-gray-200 grid place-items-center text-xs text-gray-400">Not uploaded</div>
              )}
            </div>
          </div>
          {emp.idProofUrl && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">Other ID Proof</p>
              <a href={emp.idProofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">View file →</a>
            </div>
          )}
        </div>
      )}

      {/* Bank */}
      {tab === 'bank' && isAtLeast('ADMIN') && (
        <div className="card p-5 max-w-md">
          <div className="flex items-center gap-2 mb-4"><CreditCard size={16} className="text-green-600" /><h3 className="font-semibold text-gray-900">Bank Details</h3></div>
          <InfoRow label="Bank" value={emp.bankName} />
          <InfoRow label="Account No" value={emp.accountNumber ? '****' + emp.accountNumber.slice(-4) : undefined} />
          <InfoRow label="IFSC" value={emp.ifscCode} />
        </div>
      )}

      {/* Attendance */}
      {tab === 'attendance' && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-900">Attendance</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{attTotal} record(s)</span>
              {attTotals && attTotals.recordsWithHours > 0 && (
                <>
                  <span className="badge bg-brand-50 text-brand-700"
                    title={`${attTotals.hoursWorked} decimal hours`}>Total {hm(attTotals.hoursWorked)}</span>
                  <span className="badge bg-gray-100 text-gray-600">Avg {hm(attTotals.avgHours)}</span>
                </>
              )}
            </div>
          </div>

          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-2 md:grid-cols-6 gap-2">
            <input type="month" className="input text-xs" value={attFilters.month}
              onChange={e => setAttF({ month: e.target.value, dateFrom: '', dateTo: '' })} />
            <select className="input text-xs" value={attFilters.status}
              onChange={e => setAttF({ status: e.target.value })}>
              <option value="">Status: All</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LEAVE">Leave</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
            <select className="input text-xs" value={attFilters.workMode}
              onChange={e => setAttF({ workMode: e.target.value })}>
              <option value="">Mode: All</option>
              <option value="WFO">WFO</option>
              <option value="WFH">WFH</option>
              <option value="FIELD">Field</option>
            </select>
            <select className="input text-xs" value={attFilters.late}
              onChange={e => setAttF({ late: e.target.value })}>
              <option value="">Late: Any</option>
              <option value="true">Late only</option>
              <option value="false">On time only</option>
            </select>
            <input type="date" className="input text-xs" title="From" value={attFilters.dateFrom}
              onChange={e => setAttF({ dateFrom: e.target.value, month: '' })} />
            <input type="date" className="input text-xs" title="To" value={attFilters.dateTo}
              onChange={e => setAttF({ dateTo: e.target.value, month: '' })} />
            <button
              onClick={() => { setAttFilters({ month: '', status: '', workMode: '', late: '', dateFrom: '', dateTo: '' }); setAttPage(1) }}
              className="text-xs text-red-600 hover:underline flex items-center gap-1 col-span-full">
              <X size={12} /> Clear filters
            </button>
          </div>

          <table>
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Mode</th><th>Late</th><th>Status</th></tr></thead>
            <tbody>
              {attLoading ? (
                <tr><td colSpan={7} className="text-center py-6 text-gray-400"><Loader2 size={16} className="animate-spin inline" /></td></tr>
              ) : att.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-6 text-gray-400 text-sm">No attendance records</td></tr>
              ) : att.map((a: any) => (
                <tr key={a.id}>
                  <td className="text-sm">{formatDate(a.date)}</td>
                  <td className="text-sm text-gray-600">{a.punchIn ? new Date(a.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="text-sm text-gray-600">{a.punchOut ? new Date(a.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="text-sm" title={a.hoursWorked != null ? `${a.hoursWorked} decimal hours` : ''}>
                    {hm(a.hoursWorked)}
                  </td>
                  <td className="text-xs text-gray-600">{a.workMode || '—'}</td>
                  <td className="text-xs">
                    {a.isLate
                      ? <span className="badge bg-amber-100 text-amber-700">Late {a.lateBy ? `${a.lateBy}m` : ''}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td><Badge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-5 py-3 border-t border-gray-100">
            <Pagination page={attPage} totalPages={Math.max(1, Math.ceil(attTotal / ATT_LIMIT))} onChange={setAttPage} />
          </div>
        </div>
      )}

      {/* Edit Employee */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${emp.user.name}`}>
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Work Details</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Input label="Full Name" value={form.name} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={form.phone} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} />
              <Input label="Alt Phone" value={form.altPhone} onChange={e => setForm((p: any) => ({ ...p, altPhone: e.target.value }))} />
              <Select label="Role" value={form.role} onChange={e => setForm((p: any) => ({ ...p, role: e.target.value }))}
                options={ROLES.filter(r => r !== 'SUPER_ADMIN' || user?.role === 'SUPER_ADMIN').map(r => ({ value: r, label: r.replace(/_/g, ' ') }))} />
              {form.role === 'MARKETING_EXECUTIVE' && (
                <Input label="Marketing Area" value={form.area} onChange={e => setForm((p: any) => ({ ...p, area: e.target.value }))}
                  placeholder="e.g. North Delhi, Noida, Gurugram" />
              )}
              <Select label="Department" value={form.departmentId} onChange={e => setForm((p: any) => ({ ...p, departmentId: e.target.value }))} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
              <Select label="Reports To (Team Lead)" value={form.reportingToId} onChange={e => setForm((p: any) => ({ ...p, reportingToId: e.target.value }))} options={[{ value: '', label: '— None —' }, ...allEmployees.filter((e: any) => e.id !== emp.id && e.user?.role === 'MANAGER').map((e: any) => ({ value: e.id, label: `${e.user?.name} · ${e.employeeId}${e.department?.name ? ` (${e.department.name})` : ''}` }))]} />
              <Input label="Position" value={form.position} onChange={e => setForm((p: any) => ({ ...p, position: e.target.value }))} />
              <Input label="Salary" type="number" value={form.salary} onChange={e => setForm((p: any) => ({ ...p, salary: e.target.value }))} />
              <Select label="Work Mode" value={form.workMode} onChange={e => setForm((p: any) => ({ ...p, workMode: e.target.value }))} options={WORK_MODES.map(w => ({ value: w, label: w }))} />
              <Input label="Joining Date" type="date" value={form.joiningDate} onChange={e => setForm((p: any) => ({ ...p, joiningDate: e.target.value }))} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Personal Info</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => setForm((p: any) => ({ ...p, dateOfBirth: e.target.value }))} />
              <Select label="Gender" value={form.gender} onChange={e => setForm((p: any) => ({ ...p, gender: e.target.value }))} options={GENDERS.map(g => ({ value: g, label: g }))} />
              <Select label="Blood Group" value={form.bloodGroup} onChange={e => setForm((p: any) => ({ ...p, bloodGroup: e.target.value }))} options={BLOOD_GROUPS.map(g => ({ value: g, label: g }))} />
              <Select label="Marital Status" value={form.maritalStatus} onChange={e => setForm((p: any) => ({ ...p, maritalStatus: e.target.value }))} options={MARITAL_STATUSES.map(m => ({ value: m, label: m }))} />
              <Input label="Father's Name" value={form.fatherName} onChange={e => setForm((p: any) => ({ ...p, fatherName: e.target.value }))} />
              <Input label="Mother's Name" value={form.motherName} onChange={e => setForm((p: any) => ({ ...p, motherName: e.target.value }))} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Address & Emergency Contact</h4>
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <Textarea label="Address" value={form.address} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="City" value={form.city} onChange={e => setForm((p: any) => ({ ...p, city: e.target.value }))} />
                <Input label="State" value={form.state} onChange={e => setForm((p: any) => ({ ...p, state: e.target.value }))} />
                <Input label="Pincode" value={form.pincode} onChange={e => setForm((p: any) => ({ ...p, pincode: e.target.value }))} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Emergency Contact Name" value={form.emergencyContact} onChange={e => setForm((p: any) => ({ ...p, emergencyContact: e.target.value }))} />
              <Input label="Emergency Contact Phone" value={form.emergencyPhone} onChange={e => setForm((p: any) => ({ ...p, emergencyPhone: e.target.value }))} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Identity Documents</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <Select label="ID Proof Type" value={form.idProofType} onChange={e => setForm((p: any) => ({ ...p, idProofType: e.target.value }))} options={ID_PROOF_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))} />
              <Input label="ID Proof Number" value={form.idProofNumber} onChange={e => setForm((p: any) => ({ ...p, idProofNumber: e.target.value }))} />
              <Input label="PAN Number" value={form.panNumber} onChange={e => setForm((p: any) => ({ ...p, panNumber: e.target.value }))} />
              <Input label="Aadhar Number" value={form.aadharNumber} onChange={e => setForm((p: any) => ({ ...p, aadharNumber: e.target.value }))} />
            </div>
          </div>

          {isAtLeast('ADMIN') && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bank Details</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <Input label="Bank Name" value={form.bankName} onChange={e => setForm((p: any) => ({ ...p, bankName: e.target.value }))} />
                <Input label="Account Holder Name" value={form.accountHolderName} onChange={e => setForm((p: any) => ({ ...p, accountHolderName: e.target.value }))} />
                <Input label="Account Number" value={form.accountNumber} onChange={e => setForm((p: any) => ({ ...p, accountNumber: e.target.value }))} />
                <Input label="IFSC Code" value={form.ifscCode} onChange={e => setForm((p: any) => ({ ...p, ifscCode: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title={`Change Password — ${emp.user.name}`} className="!max-w-md">
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            This will immediately replace the login password for <b>{emp.user.email}</b>.
          </div>
          <div className="flex items-end gap-2">
            <Input label="New Password" type="text" className="flex-1" value={pwdForm.password}
              onChange={e => setPwdForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" />
            <Button variant="ghost" size="sm" onClick={genPassword}>Generate</Button>
          </div>
          <Input label="Confirm Password" type="text" value={pwdForm.confirm}
            onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={pwdForm.notify}
              onChange={e => setPwdForm(f => ({ ...f, notify: e.target.checked }))} className="rounded" />
            Email the new password to {emp.user.email || 'employee'}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPwdOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={savePassword} disabled={pwdSaving}>
              {pwdSaving ? 'Saving...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={screenshotOpen} onClose={() => setScreenshotOpen(false)} title={`${emp.user.name}'s Screen`} className="!max-w-2xl">
        <div className="min-h-[200px] flex items-center justify-center">
          {screenshotLoading && (
            <div className="flex flex-col items-center gap-2 text-gray-500 py-8">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Getting a screenshot…</p>
            </div>
          )}
          {!screenshotLoading && screenshotError && (
            <div className="flex flex-col items-center gap-2 text-gray-500 py-8 text-center px-4">
              <X size={28} className="text-red-400" />
              <p className="text-sm">{screenshotError}</p>
            </div>
          )}
          {!screenshotLoading && screenshotUrl && (
            <img src={screenshotUrl} alt="Employee screen" className="w-full rounded-lg border border-gray-200" />
          )}
        </div>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`${emp.user.name} — Recent Screenshots`} className="!max-w-2xl">
        <p className="text-xs text-gray-500 -mt-2 mb-3">Auto-deleted after 7 days — this only shows what's still around.</p>
        {historyLoading && (
          <div className="flex items-center justify-center py-10 text-gray-500"><Loader2 size={24} className="animate-spin" /></div>
        )}
        {!historyLoading && history.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-10">No screenshots yet.</p>
        )}
        {!historyLoading && history.length > 0 && (
          <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
            {history.map(h => (
              <div key={h.id} className="text-left relative group">
                <button onClick={() => setHistoryPreview(h.imageUrl)} className="block w-full">
                  <img src={h.imageUrl} className="w-full aspect-video object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                </button>
                <button
                  onClick={() => deleteScreenshot(h.id)}
                  disabled={deletingId === h.id}
                  className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                  title="Delete screenshot"
                >
                  {deletingId === h.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
                <p className="text-[11px] text-gray-500 mt-1">{formatDate(h.fulfilledAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {historyPreview && createPortal(
        <div className="fixed inset-0 !mt-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setHistoryPreview(null)}>
          <img src={historyPreview} className="max-w-full max-h-full rounded-lg" />
        </div>,
        document.body
      )}
    </div>
  )
}