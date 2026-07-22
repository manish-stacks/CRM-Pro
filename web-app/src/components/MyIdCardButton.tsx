'use client'
// Header "My ID Card" button — every logged-in employee can pull up their own
// ID card (same generator used in Employees → Generate ID Card), no admin
// action needed. Opens the card in a new tab, same as the employees page does.
import { useState } from 'react'
import api from '@/lib/axios'
import { generateIdCard } from '@/lib/idCard'
import { getInitials } from '@/lib/utils'
import { IdCard, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function MyIdCardButton() {
  const [loading, setLoading] = useState(false)

  const open = async () => {
    setLoading(true)
    try {
      const r = await api.get('/auth/profile')
      const p = r.data.data
      if (!p?.employee) { toast.error("No employee record found for your account"); return }
      await generateIdCard({
        employeeId: p.employee.employeeId,
        name: p.name,
        department: p.employee.department?.name,
        position: p.employee.position,
        bloodGroup: p.employee.bloodGroup,
        phone: p.phone,
        email: p.email,
        joiningDate: p.employee.joiningDate,
        avatarUrl: p.avatar,
        avatarInitials: getInitials(p.name || 'NA'),
      })
    } catch {
      toast.error('Could not generate ID card')
    } finally { setLoading(false) }
  }

  return (
    <button onClick={open} disabled={loading}
      className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-50"
      title="My ID Card">
      {loading ? <Loader2 size={16} className="animate-spin" /> : <IdCard size={16} />}
    </button>
  )
}
