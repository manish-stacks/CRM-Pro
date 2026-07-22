'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Textarea, SearchSelect, EmptyState } from '@/components/ui'
import { Mail, Send, Loader2, User, AtSign } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ComposeMailPage() {
  const { isAtLeast } = useAuth()
  const [mode, setMode] = useState<'employee' | 'custom'>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [employeeLabel, setEmployeeLabel] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const r = await api.get('/mail/compose')
      setLogs(r.data.data || [])
    } catch { } finally { setLoadingLogs(false) }
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  if (!isAtLeast('ADMIN')) {
    return <EmptyState title="Admins only" description="This section is restricted to Admins." icon={<Mail size={24} />} />
  }

  const send = async () => {
    const to = mode === 'employee' ? employeeLabel.split('·').pop()?.trim() : toEmail.trim()
    if (!to) { toast.error('Pick an employee or enter an email'); return }
    if (!subject.trim()) { toast.error('Subject required'); return }
    if (!message.trim()) { toast.error('Message required'); return }

    setSending(true)
    try {
      await api.post('/mail/compose', { to, subject, message, employeeId: mode === 'employee' ? employeeId : undefined })
      toast.success('Email sent')
      setSubject(''); setMessage('')
      setEmployeeId(''); setEmployeeLabel(''); setToEmail('')
      loadLogs()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send')
    } finally { setSending(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Mail size={22} /> Custom Mail</h1>
        <p className="text-sm text-gray-500 mt-1">Send a one-off email to an employee or any address</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="card p-5 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMode('employee')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'employee' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              <User size={13} /> Employee
            </button>
            <button onClick={() => setMode('custom')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'custom' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              <AtSign size={13} /> Custom Email
            </button>
          </div>

          {mode === 'employee' ? (
            <SearchSelect
              label="To Employee *"
              placeholder="Search employee by name or ID..."
              value={employeeId}
              valueLabel={employeeLabel}
              onSelect={(id, label) => { setEmployeeId(id); setEmployeeLabel(label) }}
              fetchOptions={async (q) => {
                const r = await api.get(`/employees?search=${encodeURIComponent(q)}&limit=20&status=true`)
                return (r.data.data || [])
                  .filter((e: any) => e.user?.email)
                  .map((e: any) => ({ value: e.id, label: `${e.user?.name} (${e.employeeId}) · ${e.user?.email}` }))
              }}
            />
          ) : (
            <Input label="To Email *" type="email" placeholder="someone@example.com" value={toEmail} onChange={e => setToEmail(e.target.value)} />
          )}

          <Input label="Subject *" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
          <Textarea label="Message *" value={message} onChange={e => setMessage(e.target.value)} rows={8} placeholder="Write your message here..." />

          <div className="flex justify-end">
            <Button onClick={send} loading={sending}><Send size={13} /> Send Email</Button>
          </div>
        </div>

        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Recently Sent</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {loadingLogs ? (
              <div className="p-6 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
            ) : logs.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No custom emails sent yet</p>
            ) : logs.map(l => (
              <div key={l.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{l.subject}</p>
                  <p className="text-xs text-gray-500 truncate">To: {l.toEmail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`badge text-xs ${l.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : l.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{l.status}</span>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(l.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
