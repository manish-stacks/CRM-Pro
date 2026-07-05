'use client'
import { useState, useEffect } from 'react'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { Settings as SettingsIcon, Building2, DollarSign, Calendar, Clock, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Default settings shown in the form (populated from API + falls back to these)
const DEFAULTS: Record<string, any> = {
  // Company
  company_name: 'Hover Business Services',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_gst: '',
  company_logo_url: '',
  // Finance
  currency: 'INR',
  currency_symbol: '₹',
  gst_default_rate: 18,
  gst_enabled_by_default: false,
  invoice_due_days: 15,
  invoice_prefix: 'INV-',
  payment_methods: ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'],
  // HRM
  weekly_off_days: [0], // 0=Sun, 6=Sat
  working_hours_per_day: 8,
  half_day_threshold_hours: 4,
  timezone: 'Asia/Kolkata',
  // Attendance office window + late-mark
  office_start_time: '10:00',
  office_end_time: '18:30',
  late_grace_minutes: 10,
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PAYMENT_METHOD_OPTIONS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']

// Add minutes to an HH:mm string, wrapping within a day. Used for late-cutoff preview.
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = (hhmm || '10:00').split(':').map(Number)
  const total = ((h * 60 + m + (mins || 0)) % 1440 + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// 24h HH:mm -> friendly "10:10 AM"
function pretty(hhmm: string): string {
  const [h, m] = (hhmm || '00:00').split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [values, setValues] = useState<Record<string, any>>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'company' | 'finance' | 'hrm' | 'attendance'>('company')

  useEffect(() => {
    api.get('/settings').then(r => {
      const grouped = r.data.data?.grouped || {}
      const merged: Record<string, any> = { ...DEFAULTS }
      for (const cat of Object.keys(grouped)) {
        Object.assign(merged, grouped[cat])
      }
      setValues(merged)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const set = (key: string, value: any) => setValues(prev => ({ ...prev, [key]: value }))

  const toggleWeeklyOff = (day: number) => {
    const current = Array.isArray(values.weekly_off_days) ? values.weekly_off_days : [0]
    const updated = current.includes(day)
      ? current.filter((d: number) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    set('weekly_off_days', updated)
  }

  const togglePaymentMethod = (m: string) => {
    const current = Array.isArray(values.payment_methods) ? values.payment_methods : []
    const updated = current.includes(m) ? current.filter((x: string) => x !== m) : [...current, m]
    set('payment_methods', updated)
  }

  const save = async () => {
    setSaving(true)
    try {
      // Bucket the values by category (must include EVERY editable key)
      const CATS: Record<string, string[]> = {
        company: ['company_name', 'company_address', 'company_phone', 'company_email', 'company_gst', 'company_logo_url', 'timezone'],
        finance: ['currency', 'currency_symbol', 'gst_default_rate', 'gst_enabled_by_default', 'invoice_due_days', 'invoice_prefix', 'payment_methods'],
        hrm: ['weekly_off_days', 'working_hours_per_day', 'half_day_threshold_hours'],
        attendance: ['office_start_time', 'office_end_time', 'late_grace_minutes'],
      }
      const settings: Record<string, { value: any; category: string }> = {}
      for (const [cat, keys] of Object.entries(CATS)) {
        for (const k of keys) settings[k] = { value: values[k], category: cat }
      }
      await api.put('/settings', { settings })
      toast.success('Settings saved')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>

  const graceMins = Number(values.late_grace_minutes ?? 10)
  const cutoff = addMinutes(values.office_start_time || '10:00', graceMins)

  return (
    <div className="space-y-5  mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon size={22} /> Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">Company, finance, HRM &amp; attendance configuration</p>
        </div>
        <Button onClick={save} loading={saving}><Save size={13} /> Save All</Button>
      </div>

      <div className="card">
        <div className="border-b border-gray-100 flex items-center overflow-x-auto">
          {[
            { key: 'company', label: 'Company', icon: Building2 },
            { key: 'finance', label: 'Finance & Invoicing', icon: DollarSign },
            { key: 'hrm', label: 'HRM & Payroll', icon: Calendar },
            { key: 'attendance', label: 'Attendance & Late Mark', icon: Clock },
          ].map((t: any) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {tab === 'company' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Company Name" value={values.company_name || ''} onChange={e => set('company_name', e.target.value)} />
                <Input label="GST Number" value={values.company_gst || ''} onChange={e => set('company_gst', e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" />
                <Input label="Phone" value={values.company_phone || ''} onChange={e => set('company_phone', e.target.value)} />
                <Input label="Email" type="email" value={values.company_email || ''} onChange={e => set('company_email', e.target.value)} />
                <Input label="Logo URL" value={values.company_logo_url || ''} onChange={e => set('company_logo_url', e.target.value)} placeholder="https://..." />
                <Select label="Timezone" value={values.timezone || 'Asia/Kolkata'} onChange={e => set('timezone', e.target.value)} options={[
                  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
                  { value: 'UTC', label: 'UTC' },
                  { value: 'America/New_York', label: 'America/New_York (EST)' },
                  { value: 'Europe/London', label: 'Europe/London (GMT)' },
                ]} />
              </div>
              <Textarea label="Address" value={values.company_address || ''} onChange={e => set('company_address', e.target.value)} rows={3}
                placeholder="Full address for invoices and emails" />
              <p className="text-xs text-gray-500">This information is used on invoices, proposals, and email templates.</p>
            </>
          )}

          {tab === 'finance' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Currency" value={values.currency || 'INR'} onChange={e => set('currency', e.target.value)} options={[
                  { value: 'INR', label: 'INR — Indian Rupee' },
                  { value: 'USD', label: 'USD — US Dollar' },
                  { value: 'EUR', label: 'EUR — Euro' },
                  { value: 'GBP', label: 'GBP — British Pound' },
                  { value: 'AED', label: 'AED — UAE Dirham' },
                ]} />
                <Input label="Currency Symbol" value={values.currency_symbol || '₹'} onChange={e => set('currency_symbol', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Default GST Rate (%)" type="number" value={values.gst_default_rate ?? 18} onChange={e => set('gst_default_rate', Number(e.target.value))} />
                <div>
                  <label className="label">GST Enabled by Default</label>
                  <div className="flex items-center gap-3 h-9">
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                      <input type="radio" checked={!values.gst_enabled_by_default} onChange={() => set('gst_enabled_by_default', false)} /> No
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-sm">
                      <input type="radio" checked={!!values.gst_enabled_by_default} onChange={() => set('gst_enabled_by_default', true)} /> Yes
                    </label>
                  </div>
                </div>
                <Input label="Invoice Due Days" type="number" value={values.invoice_due_days ?? 15} onChange={e => set('invoice_due_days', Number(e.target.value))} />
              </div>
              <Input label="Invoice Prefix" value={values.invoice_prefix || 'INV-'} onChange={e => set('invoice_prefix', e.target.value)}
                placeholder="e.g. INV-, HBS/INV/, etc." />
              <div>
                <label className="label">Accepted Payment Methods</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {PAYMENT_METHOD_OPTIONS.map(m => {
                    const active = Array.isArray(values.payment_methods) && values.payment_methods.includes(m)
                    return (
                      <button key={m} type="button" onClick={() => togglePaymentMethod(m)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}>
                        {m.replace(/_/g, ' ')}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="text-xs text-gray-500">Applies to newly created invoices. Existing invoices keep their existing numbers.</p>
            </>
          )}

          {tab === 'hrm' && (
            <>
              <div>
                <label className="label">Weekly Off Days</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {DAYS.map((d, i) => {
                    const active = Array.isArray(values.weekly_off_days) && values.weekly_off_days.includes(i)
                    return (
                      <button key={i} type="button" onClick={() => toggleWeeklyOff(i)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}>
                        {d}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">Weekly offs are excluded from working-day calculation for payroll.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Working Hours Per Day" type="number" value={values.working_hours_per_day ?? 8}
                  onChange={e => set('working_hours_per_day', Number(e.target.value))} />
                <Input label="Half-Day Threshold (hours)" type="number" step="0.5" value={values.half_day_threshold_hours ?? 4}
                  onChange={e => set('half_day_threshold_hours', Number(e.target.value))} />
              </div>
              <p className="text-xs text-gray-500">
                A punch-in–punch-out session below the half-day threshold marks attendance as HALF_DAY.
              </p>
            </>
          )}

          {tab === 'attendance' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Office Start Time</label>
                  <input type="time" className="input" value={values.office_start_time || '10:00'}
                    onChange={e => set('office_start_time', e.target.value)} />
                </div>
                <div>
                  <label className="label">Office End Time</label>
                  <input type="time" className="input" value={values.office_end_time || '18:30'}
                    onChange={e => set('office_end_time', e.target.value)} />
                </div>
                <Input label="Late Grace (minutes)" type="number" min="0" value={values.late_grace_minutes ?? 10}
                  onChange={e => set('late_grace_minutes', Number(e.target.value))} />
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800 flex items-start gap-2">
                <Clock size={15} className="mt-0.5 flex-shrink-0" />
                <div>
                  Punch-in <b>{pretty(cutoff)}</b> ke baad → <b>Late Mark</b>.
                  <div className="text-xs text-amber-700 mt-0.5">
                    Office {pretty(values.office_start_time || '10:00')} start + {graceMins} min grace.
                    {graceMins === 0 && ' (Grace 0 — start ke baad hi late.)'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Time IST (Asia/Kolkata) me evaluate hota hai. <code>lateBy</code> = office start se kitne minute late.
                Ye punch-in ke waqt calculate hota hai — purane records par lagu nahi hota.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}