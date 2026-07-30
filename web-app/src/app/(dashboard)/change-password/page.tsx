'use client'
import { useState } from 'react'
import api from '@/lib/axios'
import { Input, Button } from '@/components/ui'
import { KeyRound, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ChangePasswordPage() {
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const changePassword = async () => {
    if (!pwdForm.currentPassword || !pwdForm.newPassword) { toast.error('All fields required'); return }
    if (pwdForm.newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return }
    if (pwdForm.newPassword !== pwdForm.confirm) { toast.error('Passwords do not match'); return }
    setPwdSaving(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      })
      toast.success('Password changed successfully')
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to change password')
    } finally { setPwdSaving(false) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <KeyRound size={22} /> Change Password
        </h1>
        <p className="text-sm text-gray-500 mt-1">Use a strong password you don&apos;t use elsewhere</p>
      </div>

      <div className="card p-5 space-y-4">
        <Input label="Current Password" type="password" value={pwdForm.currentPassword}
          onChange={e => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))} />
        <Input label="New Password" type="password" value={pwdForm.newPassword}
          onChange={e => setPwdForm(p => ({ ...p, newPassword: e.target.value }))} />
        <Input label="Confirm New Password" type="password" value={pwdForm.confirm}
          onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))} />
        <Button onClick={changePassword} loading={pwdSaving} className="w-full">
          <KeyRound size={14} /> Update Password
        </Button>
      </div>

      <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 text-xs text-blue-800 flex items-start gap-2">
        <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
        Use at least 6 characters with a mix of letters and numbers. You&apos;ll stay logged in on this device after changing it.
      </div>
    </div>
  )
}
