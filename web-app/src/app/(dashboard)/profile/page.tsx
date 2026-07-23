'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Input, Select, Textarea, Button } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import {
  User, Phone, Mail, MapPin, Building2, CreditCard, Camera, Upload,
  Loader2, Check, Lock, Calendar, Briefcase, Heart, Info, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'

const GENDER = ['Male', 'Female', 'Other']
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const ID_PROOF_TYPES = ['AADHAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID']

function Section({ icon: Icon, title, description, children }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-brand-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">{label} <Lock size={10} className="text-gray-400" /></label>
      <div className="input bg-gray-50 text-gray-600 cursor-not-allowed flex items-center">
        {value || '—'}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [aadharFrontUploading, setAadharFrontUploading] = useState(false)
  const [aadharBackUploading, setAadharBackUploading] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpValue, setEmailOtpValue] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const aadharFrontRef = useRef<HTMLInputElement>(null)
  const aadharBackRef = useRef<HTMLInputElement>(null)

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const r = await api.get('/auth/profile')
      const p = r.data.data || r.data
      setProfile(p)
      const emp = p.employee || {}
      setForm({
        // User
        name: p.name || '',
        phone: p.phone || '',
        altPhone: p.altPhone || '',
        avatar: p.avatar || '',
        dateOfBirth: p.dateOfBirth?.split('T')[0] || emp.dateOfBirth?.split('T')[0] || '',
        // Employee
        gender: emp.gender || '',
        bloodGroup: emp.bloodGroup || '',
        maritalStatus: emp.maritalStatus || '',
        fatherName: emp.fatherName || '',
        motherName: emp.motherName || '',
        address: emp.address || '',
        city: emp.city || '',
        state: emp.state || '',
        pincode: emp.pincode || '',
        emergencyContact: emp.emergencyContact || '',
        emergencyPhone: emp.emergencyPhone || '',
        panNumber: emp.panNumber || '',
        aadharNumber: emp.aadharNumber || '',
        aadharFrontUrl: emp.aadharFrontUrl || '',
        aadharBackUrl: emp.aadharBackUrl || '',
        idProofType: emp.idProofType || '',
        idProofNumber: emp.idProofNumber || '',
        bankName: emp.bankName || '',
        accountNumber: emp.accountNumber || '',
        ifscCode: emp.ifscCode || '',
        accountHolderName: emp.accountHolderName || '',
      })
    } catch { toast.error('Failed to load profile') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProfile() }, [])

  const upd = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/auth/profile', form)
      toast.success('Profile updated!')
      await fetchProfile()
      await refreshUser()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Update failed')
    } finally { setSaving(false) }
  }

  const uploadImage = async (file: File, folder: string, setter: (v: boolean) => void, field: string) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return }
    setter(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const r = await api.post('/upload', { dataUrl, folder })
      upd(field, r.data.data.url)
      toast.success('Uploaded!')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload failed')
    } finally { setter(false) }
  }

  const emp = profile?.employee

  const sendEmailOtp = async () => {
    setSendingOtp(true)
    try {
      await api.post('/auth/send-email-otp')
      toast.success('Verification code sent to your email')
      setEmailOtpSent(true)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send code')
    } finally { setSendingOtp(false) }
  }

  const verifyEmailOtp = async () => {
    if (!emailOtpValue.trim()) { toast.error('Enter the code'); return }
    setVerifyingOtp(true)
    try {
      await api.post('/auth/verify-email-otp', { otp: emailOtpValue.trim() })
      toast.success('Email verified! ✅')
      setEmailOtpSent(false)
      setEmailOtpValue('')
      await fetchProfile()
      await refreshUser()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Verification failed')
    } finally { setVerifyingOtp(false) }
  }

  if (loading) return <div className="p-8 text-center text-gray-400"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6  mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Update your personal information. Fields marked with 🔒 can only be changed by admin.</p>
      </div>

      {/* Avatar + Header */}
      <div className="card p-5 flex items-center gap-5">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
            {form.avatar ? <img src={form.avatar} alt="" className="w-full h-full object-cover" /> : (profile?.name?.[0] || '?')}
          </div>
          
          <button
            onClick={() => avatarRef.current?.click()}
            disabled={avatarUploading}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:border-brand-500 disabled:opacity-50"
          >
            {avatarUploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} className="text-gray-700" />}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'avatars', setAvatarUploading, 'avatar')} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">{profile?.name}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-gray-500">{profile?.email}</p>
            {profile?.role !== 'ADMIN' && profile?.role !== 'SUPER_ADMIN' && (
              profile?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                  <Check size={11} /> Verified
                </span>
              ) : !emailOtpSent ? (
                <button onClick={sendEmailOtp} disabled={sendingOtp}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100 disabled:opacity-50">
                  {sendingOtp ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
                  Verify Email
                </button>
              ) : null
            )}
          </div>
          {profile?.role !== 'ADMIN' && profile?.role !== 'SUPER_ADMIN' && !profile?.emailVerified && emailOtpSent && (
            <div className="flex items-center gap-2 mt-2">
              <input
                value={emailOtpValue}
                onChange={e => setEmailOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="input !w-32 !py-1.5 text-sm tracking-widest"
                maxLength={6}
              />
              <button onClick={verifyEmailOtp} disabled={verifyingOtp}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50">
                {verifyingOtp ? <Loader2 size={12} className="animate-spin" /> : 'Verify'}
              </button>
              <button onClick={sendEmailOtp} disabled={sendingOtp} className="text-xs text-brand-600 hover:underline">
                Resend
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="badge bg-brand-100 text-brand-700">{profile?.role?.replace(/_/g, ' ')}</span>
            {emp?.employeeId && <span className="badge bg-slate-100 text-slate-700">{emp.employeeId}</span>}
            {emp?.department && <span className="badge bg-purple-100 text-purple-700">{emp.department.name}</span>}
          </div>
        </div>
        <Button onClick={save} loading={saving}><Check size={14} /> Save Changes</Button>
      </div>

      {/* Employment (read-only) */}
      <Section icon={Briefcase} title="Employment Info" description="Managed by admin — contact HR for changes">
        <ReadOnlyField label="Employee ID" value={emp?.employeeId} />
        <ReadOnlyField label="Role" value={profile?.role?.replace(/_/g, ' ')} />
        <ReadOnlyField label="Department" value={emp?.department?.name} />
        <ReadOnlyField label="Position" value={emp?.position} />
        <ReadOnlyField label="Joining Date" value={emp?.joiningDate ? formatDate(emp.joiningDate) : null} />
        <ReadOnlyField label="Work Mode" value={emp?.workMode} />
        <ReadOnlyField label="Monthly Salary" value={emp?.salary ? `₹${emp.salary.toLocaleString('en-IN')}` : null} />
        <ReadOnlyField label="Email" value={profile?.email} />
      </Section>

      {/* Personal */}
      <Section icon={User} title="Personal Information" description="Edit any of these fields">
        <Input label="Full Name" value={form.name} onChange={e => upd('name', e.target.value)} />
        <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => upd('dateOfBirth', e.target.value)} />
        <Select
          label="Gender"
          value={form.gender}
          onChange={e => upd('gender', e.target.value)}
          options={[
            { value: "", label: "Choose Gender" },
            ...GENDER.map(g => ({ value: g, label: g }))
          ]}
        />

        <Select
          label="Marital Status"
          value={form.maritalStatus}
          onChange={e => upd('maritalStatus', e.target.value)}
          options={[
            { value: "", label: "Choose Marital Status" },
            ...MARITAL.map(m => ({ value: m, label: m }))
          ]}
        />

        <Select
          label="Blood Group"
          value={form.bloodGroup}
          onChange={e => upd('bloodGroup', e.target.value)}
          options={[
            { value: "", label: "Choose Blood Group" },
            ...BLOOD_GROUPS.map(b => ({ value: b, label: b }))
          ]}
        />
        <Input label="Father's Name" value={form.fatherName} onChange={e => upd('fatherName', e.target.value)} />
        <Input label="Mother's Name" value={form.motherName} onChange={e => upd('motherName', e.target.value)} />
      </Section>

      {/* Contact */}
      <Section icon={Phone} title="Contact Information">
        <Input label="Phone" value={form.phone} onChange={e => upd('phone', e.target.value)} placeholder="+91 9999999999" />
        <Input label="Alternate Phone" value={form.altPhone} onChange={e => upd('altPhone', e.target.value)} />
        <Textarea label="Address" value={form.address} onChange={e => upd('address', e.target.value)} className="md:col-span-2" rows={2} />
        <Input label="City" value={form.city} onChange={e => upd('city', e.target.value)} />
        <Input label="State" value={form.state} onChange={e => upd('state', e.target.value)} />
        <Input label="Pincode" value={form.pincode} onChange={e => upd('pincode', e.target.value)} />
      </Section>

      {/* Emergency Contact */}
      <Section icon={Heart} title="Emergency Contact">
        <Input label="Contact Name" value={form.emergencyContact} onChange={e => upd('emergencyContact', e.target.value)} />
        <Input label="Contact Phone" value={form.emergencyPhone} onChange={e => upd('emergencyPhone', e.target.value)} />
      </Section>

      {/* ID Proofs */}
      <Section icon={FileText} title="ID Proofs">
        <Select
          label="ID Proof Type"
          value={form.idProofType}
          onChange={e => upd('idProofType', e.target.value)}
          options={[
            { value: "", label: "Choose ID Proof Type" },
            ...ID_PROOF_TYPES.map(t => ({
              value: t,
              label: t.replace(/_/g, " "),
            })),
          ]}
        />
        <Input label="ID Proof Number" value={form.idProofNumber} onChange={e => upd('idProofNumber', e.target.value)} />
        <Input label="PAN Number" value={form.panNumber} onChange={e => upd('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
        <Input label="Aadhar Number" value={form.aadharNumber} onChange={e => upd('aadharNumber', e.target.value)} placeholder="XXXX XXXX XXXX" />
        <div>
          <label className="label">Aadhar Front</label>
          <div className="flex items-center gap-2">
            {form.aadharFrontUrl ? (
              <a href={form.aadharFrontUrl} target="_blank" className="flex-1 input bg-green-50 border-green-200 text-green-700 flex items-center gap-1 underline"><Check size={13} /> Click to View / Upload</a>
            ) : (
              <div className="flex-1 input text-gray-400">Not uploaded</div>
            )}
            <button
              onClick={() => aadharFrontRef.current?.click()}
              disabled={aadharFrontUploading}
              className="btn-secondary btn-sm"
            >
              {aadharFrontUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
            <input ref={aadharFrontRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'aadhar', setAadharFrontUploading, 'aadharFrontUrl')} />
          </div>
        </div>
        <div>
          <label className="label">Aadhar Back</label>
          <div className="flex items-center gap-2">
            {form.aadharBackUrl ? (
              <a href={form.aadharBackUrl} target="_blank" className="flex-1 input bg-green-50 border-green-200 text-green-700 flex items-center gap-1 underline"><Check size={13} /> Click to View / Upload</a>
            ) : (
              <div className="flex-1 input text-gray-400">Not uploaded</div>
            )}
            <button
              onClick={() => aadharBackRef.current?.click()}
              disabled={aadharBackUploading}
              className="btn-secondary btn-sm"
            >
              {aadharBackUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
            </button>
            <input ref={aadharBackRef} type="file" accept="image/*,.pdf" className="hidden"
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0], 'aadhar', setAadharBackUploading, 'aadharBackUrl')} />
          </div>
        </div>
      </Section>

      {/* Bank Details */}
      <Section icon={CreditCard} title="Bank Account Details" description="Used for salary transfers">
        <Input label="Account Holder Name" value={form.accountHolderName} onChange={e => upd('accountHolderName', e.target.value)} />
        <Input label="Bank Name" value={form.bankName} onChange={e => upd('bankName', e.target.value)} />
        <Input label="Account Number" value={form.accountNumber} onChange={e => upd('accountNumber', e.target.value)} />
        <Input label="IFSC Code" value={form.ifscCode} onChange={e => upd('ifscCode', e.target.value.toUpperCase())} placeholder="HDFC0001234" />
      </Section>

      {/* Sticky footer save */}
      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} loading={saving} className="shadow-lg"><Check size={14} /> Save Changes</Button>
      </div>
    </div>
  )
}
