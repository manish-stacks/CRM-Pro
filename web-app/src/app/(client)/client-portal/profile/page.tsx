'use client'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, CheckCircle2, Lock, Camera } from 'lucide-react'
import { useClientPortal } from '../context'

export default function ProfilePage() {
  const {
    client, initials, profileForm, setProfileForm, savingProfile, saveProfile,
    pwdForm, setPwdForm, changePwd,
  } = useClientPortal()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  if (!client) return null

  const pickPhoto = () => {
    if (uploadingPhoto) return
    fileInputRef.current?.click()
  }

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image too large. Max 8MB'); return }

    setUploadingPhoto(true)
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const r = await fetch('/api/client-portal/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error || 'Upload failed'); return }

      setProfileForm((p: any) => ({ ...p, image: d.data?.url }))
      toast.success('Photo uploaded — click Save Changes to apply')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-5">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} />
          <button type="button" onClick={pickPhoto} disabled={uploadingPhoto}
            className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-xl overflow-hidden shrink-0 group">
            {uploadingPhoto ? (
              <Loader2 size={18} className="animate-spin" />
            ) : profileForm.image ? (
              <img src={profileForm.image} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
              <Camera size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
          <div>
            <h3 className="font-bold text-gray-900">{client.companyName}</h3>
            <p className="text-xs text-gray-400 font-mono">{client.clientCode}</p>
            <button type="button" onClick={pickPhoto} disabled={uploadingPhoto} className="text-xs text-indigo-600 hover:underline mt-1">
              {uploadingPhoto ? 'Uploading...' : 'Change photo'}
            </button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['Company', 'companyName', true], ['Client Name', 'clientName', false],
            ['Phone', 'phone', false], ['Email', 'email', false],
            ['City', 'city', false], ['State', 'state', false],
          ].map(([label, key, dis]: any) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus:border-indigo-500"
                value={profileForm[key] || ''} disabled={dis}
                onChange={e => setProfileForm((p: any) => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Address</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              value={profileForm.address || ''} onChange={e => setProfileForm((p: any) => ({ ...p, address: e.target.value }))} />
          </div>
        </div>
        <button onClick={saveProfile} disabled={savingProfile} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
          {savingProfile ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />} Save Changes
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5"><Lock size={15} /> Change Password</h3>
        <div className="space-y-2 max-w-md">
          <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Current password" value={pwdForm.currentPassword} onChange={e => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))} />
          <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="New password (min 6)" value={pwdForm.newPassword} onChange={e => setPwdForm(p => ({ ...p, newPassword: e.target.value }))} />
          <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Confirm new password" value={pwdForm.confirm} onChange={e => setPwdForm(p => ({ ...p, confirm: e.target.value }))} />
          <button onClick={changePwd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium">Change Password</button>
        </div>
      </div>
    </div>
  )
}