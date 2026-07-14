'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button, Badge, Modal, Input, Select, Textarea } from '@/components/ui'
import { formatDate, formatCurrency, getInitials } from '@/lib/utils'
import { ArrowLeft, User, Briefcase, CreditCard, FileText, Phone, Mail, Building2, Calendar, MapPin, Shield, Droplets, HeartPulse } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

const WORK_MODES = ['WFO', 'WFH', 'HYBRID']
const GENDERS = ['MALE', 'FEMALE', 'OTHER']
const MARITAL_STATUSES = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const ID_PROOF_TYPES = ['AADHAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID']

const emptyForm = {
  name: '', phone: '', altPhone: '',
  departmentId: '', reportingToId: '', position: '', salary: '', workMode: 'WFO', joiningDate: '',
  dateOfBirth: '', gender: '', bloodGroup: '', maritalStatus: '',
  fatherName: '', motherName: '',
  address: '', city: '', state: '', pincode: '',
  emergencyContact: '', emergencyPhone: '',
  panNumber: '', aadharNumber: '',
  idProofType: '', idProofNumber: '',
  bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '',
}

export default function EmployeeDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { isAtLeast } = useAuth()
  const [emp, setEmp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const [departments, setDepartments] = useState<any[]>([])
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)

  const fetchEmp = () => {
    setLoading(true)
    return api.get(`/employees/${id}`).then(r => setEmp(r.data.data)).catch(() => router.push('/employees')).finally(() => setLoading(false))
  }

  useEffect(() => { fetchEmp() }, [id])

  const [balance, setBalance] = useState<any>(null)
  useEffect(() => {
    if (id) api.get(`/leaves/balance?employeeId=${id}`).then(r => setBalance(r.data.data)).catch(() => {})
  }, [id])

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => {})
    api.get('/employees?role=MANAGER&limit=200').then(r => setAllEmployees(r.data.data || [])).catch(() => {})
  }, [])

  const toInputDate = (d: any) => d ? new Date(d).toISOString().split('T')[0] : ''

  const openEdit = () => {
    if (!emp) return
    setForm({
      name: emp.user.name || '', phone: emp.user.phone || '', altPhone: emp.user.altPhone || '',
      departmentId: emp.department?.id || '', reportingToId: emp.reportingToId || '', position: emp.position || '', salary: emp.salary || '',
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!emp) return null

  const TABS = ['overview', 'personal', 'documents', 'bank', 'attendance']

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value || '—'}</span>
    </div>
  )

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="space-y-6 mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link href="/employees"><Button variant="ghost" size="sm"><ArrowLeft size={15}/>Back</Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
              {getInitials(emp.user.name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{emp.user.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{emp.employeeId}</span>
                <span className="text-sm text-gray-500">{emp.position || emp.user.role.replace(/_/g,' ')}</span>
                {emp.department && <span className="text-xs text-gray-400">· {emp.department.name}</span>}
                <Badge status={emp.user.isActive ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>
          </div>
        </div>
        {isAtLeast('ADMIN') && (
          <Button variant="primary" size="sm" onClick={openEdit}>Edit</Button>
        )}
      </div>

      {/* Tab pills */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?'bg-white shadow text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {balance && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-5">
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
              <div className="flex items-center gap-2 mb-4"><Briefcase size={16} className="text-blue-600"/><h3 className="font-semibold text-gray-900">Work Details</h3></div>
              <InfoRow label="Role" value={emp.user.role.replace(/_/g,' ')} />
              <InfoRow label="Position" value={emp.position} />
              <InfoRow label="Department" value={emp.department?.name} />
              <InfoRow label="Reports To (Team Lead)" value={emp.reportingTo?.user?.name} />
              <InfoRow label="Work Mode" value={emp.workMode} />
              <InfoRow label="Joining Date" value={emp.joiningDate ? formatDate(emp.joiningDate) : undefined} />
              <InfoRow label="Salary" value={emp.salary ? formatCurrency(emp.salary) : undefined} />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4"><User size={16} className="text-green-600"/><h3 className="font-semibold text-gray-900">Contact</h3></div>
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
            <div className="flex items-center gap-2 mb-4"><HeartPulse size={16} className="text-pink-500"/><h3 className="font-semibold text-gray-900">Personal Info</h3></div>
            <InfoRow label="Date of Birth" value={emp.dateOfBirth ? formatDate(emp.dateOfBirth) : undefined} />
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Blood Group" value={emp.bloodGroup} />
            <InfoRow label="Marital Status" value={emp.maritalStatus} />
            <InfoRow label="Father's Name" value={emp.fatherName} />
            <InfoRow label="Mother's Name" value={emp.motherName} />
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4"><Shield size={16} className="text-orange-500"/><h3 className="font-semibold text-gray-900">Emergency Contact</h3></div>
            <InfoRow label="Name" value={emp.emergencyContact} />
            <InfoRow label="Phone" value={emp.emergencyPhone} />
          </div>
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && (
        <div className="card p-5 max-w-md">
          <div className="flex items-center gap-2 mb-4"><FileText size={16} className="text-indigo-600"/><h3 className="font-semibold text-gray-900">Identity Documents</h3></div>
          <InfoRow label="ID Type" value={emp.idProofType} />
          <InfoRow label="ID Number" value={emp.idProofNumber} />
          <InfoRow label="PAN Number" value={emp.panNumber} />
        </div>
      )}

      {/* Bank */}
      {tab === 'bank' && isAtLeast('ADMIN') && (
        <div className="card p-5 max-w-md">
          <div className="flex items-center gap-2 mb-4"><CreditCard size={16} className="text-green-600"/><h3 className="font-semibold text-gray-900">Bank Details</h3></div>
          <InfoRow label="Bank" value={emp.bankName} />
          <InfoRow label="Account No" value={emp.accountNumber ? '****' + emp.accountNumber.slice(-4) : undefined} />
          <InfoRow label="IFSC" value={emp.ifscCode} />
        </div>
      )}

      {/* Attendance */}
      {tab === 'attendance' && (
        <div className="card overflow-hidden">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Recent Attendance</h3></div>
          <table>
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {(emp.attendance || []).slice(0, 20).map((a: any) => (
                <tr key={a.id}>
                  <td className="text-sm">{formatDate(a.date)}</td>
                  <td className="text-sm text-gray-600">{a.punchIn ? new Date(a.punchIn).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                  <td className="text-sm text-gray-600">{a.punchOut ? new Date(a.punchOut).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                  <td className="text-sm">{a.hoursWorked?.toFixed(1) || '—'}h</td>
                  <td><Badge status={a.status}/></td>
                </tr>
              ))}
              {(!emp.attendance || emp.attendance.length === 0) && (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-sm">No attendance records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Employee */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${emp.user.name}`}>
        <div className="space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Work Details</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Input label="Full Name" value={form.name} onChange={e => setForm((p: any) => ({...p, name: e.target.value}))} />
              <Input label="Phone" value={form.phone} onChange={e => setForm((p: any) => ({...p, phone: e.target.value}))} />
              <Input label="Alt Phone" value={form.altPhone} onChange={e => setForm((p: any) => ({...p, altPhone: e.target.value}))} />
              <Select label="Department" value={form.departmentId} onChange={e => setForm((p: any) => ({...p, departmentId: e.target.value}))} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
              <Select label="Reports To (Team Lead)" value={form.reportingToId} onChange={e => setForm((p: any) => ({...p, reportingToId: e.target.value}))} options={[{ value: '', label: '— None —' }, ...allEmployees.filter((e: any) => e.id !== emp.id && e.user?.role === 'MANAGER').map((e: any) => ({ value: e.id, label: `${e.user?.name} · ${e.employeeId}${e.department?.name ? ` (${e.department.name})` : ''}` }))]} />
              <Input label="Position" value={form.position} onChange={e => setForm((p: any) => ({...p, position: e.target.value}))} />
              <Input label="Salary" type="number" value={form.salary} onChange={e => setForm((p: any) => ({...p, salary: e.target.value}))} />
              <Select label="Work Mode" value={form.workMode} onChange={e => setForm((p: any) => ({...p, workMode: e.target.value}))} options={WORK_MODES.map(w => ({ value: w, label: w }))} />
              <Input label="Joining Date" type="date" value={form.joiningDate} onChange={e => setForm((p: any) => ({...p, joiningDate: e.target.value}))} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Personal Info</h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => setForm((p: any) => ({...p, dateOfBirth: e.target.value}))} />
              <Select label="Gender" value={form.gender} onChange={e => setForm((p: any) => ({...p, gender: e.target.value}))} options={GENDERS.map(g => ({ value: g, label: g }))} />
              <Select label="Blood Group" value={form.bloodGroup} onChange={e => setForm((p: any) => ({...p, bloodGroup: e.target.value}))} options={BLOOD_GROUPS.map(g => ({ value: g, label: g }))} />
              <Select label="Marital Status" value={form.maritalStatus} onChange={e => setForm((p: any) => ({...p, maritalStatus: e.target.value}))} options={MARITAL_STATUSES.map(m => ({ value: m, label: m }))} />
              <Input label="Father's Name" value={form.fatherName} onChange={e => setForm((p: any) => ({...p, fatherName: e.target.value}))} />
              <Input label="Mother's Name" value={form.motherName} onChange={e => setForm((p: any) => ({...p, motherName: e.target.value}))} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Address & Emergency Contact</h4>
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <Textarea label="Address" value={form.address} onChange={e => setForm((p: any) => ({...p, address: e.target.value}))} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="City" value={form.city} onChange={e => setForm((p: any) => ({...p, city: e.target.value}))} />
                <Input label="State" value={form.state} onChange={e => setForm((p: any) => ({...p, state: e.target.value}))} />
                <Input label="Pincode" value={form.pincode} onChange={e => setForm((p: any) => ({...p, pincode: e.target.value}))} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Emergency Contact Name" value={form.emergencyContact} onChange={e => setForm((p: any) => ({...p, emergencyContact: e.target.value}))} />
              <Input label="Emergency Contact Phone" value={form.emergencyPhone} onChange={e => setForm((p: any) => ({...p, emergencyPhone: e.target.value}))} />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Identity Documents</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <Select label="ID Proof Type" value={form.idProofType} onChange={e => setForm((p: any) => ({...p, idProofType: e.target.value}))} options={ID_PROOF_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))} />
              <Input label="ID Proof Number" value={form.idProofNumber} onChange={e => setForm((p: any) => ({...p, idProofNumber: e.target.value}))} />
              <Input label="PAN Number" value={form.panNumber} onChange={e => setForm((p: any) => ({...p, panNumber: e.target.value}))} />
              <Input label="Aadhar Number" value={form.aadharNumber} onChange={e => setForm((p: any) => ({...p, aadharNumber: e.target.value}))} />
            </div>
          </div>

          {isAtLeast('ADMIN') && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bank Details</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <Input label="Bank Name" value={form.bankName} onChange={e => setForm((p: any) => ({...p, bankName: e.target.value}))} />
                <Input label="Account Holder Name" value={form.accountHolderName} onChange={e => setForm((p: any) => ({...p, accountHolderName: e.target.value}))} />
                <Input label="Account Number" value={form.accountNumber} onChange={e => setForm((p: any) => ({...p, accountNumber: e.target.value}))} />
                <Input label="IFSC Code" value={form.ifscCode} onChange={e => setForm((p: any) => ({...p, ifscCode: e.target.value}))} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} loading={saving}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}