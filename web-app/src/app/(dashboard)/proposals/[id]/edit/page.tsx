'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Textarea } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2, Save, Loader2, FileText, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

interface Item {
  id: string
  serviceId?: string
  serviceName: string
  description: string
  quantity: number
  unitPrice: number
}

// Only Admin and the telecalling head (MANAGER = "TL") may edit an existing proposal
const CAN_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']

export default function ProposalEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { user } = useAuth()
  const canEdit = CAN_EDIT_ROLES.includes(user?.role || '')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [proposal, setProposal] = useState<any>(null)
  const [catalog, setCatalog] = useState<any[]>([])

  const [form, setForm] = useState({
    title: '', notes: '', terms: '', validUntil: '',
    discount: 0, discountType: 'FIXED' as 'FIXED' | 'PERCENT',
    gstApplicable: false, gstRate: 18,
  })
  const [items, setItems] = useState<Item[]>([])

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/proposals/${id}`)
      const p = r.data.data
      setProposal(p)
      setForm({
        title: p.title || '',
        notes: p.notes || '',
        terms: p.terms || '',
        validUntil: p.validUntil ? p.validUntil.split('T')[0] : '',
        discount: p.discount || 0,
        discountType: p.discountType || 'FIXED',
        gstApplicable: !!p.gstApplicable,
        gstRate: p.gstRate || 18,
      })
      setItems((p.items || []).map((i: any) => ({
        id: i.id, serviceId: i.serviceId, serviceName: i.serviceName || '',
        description: i.description, quantity: i.quantity, unitPrice: i.unitPrice,
      })))
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load proposal')
      router.push('/proposals')
    } finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { fetch_() }, [fetch_])
  useEffect(() => { api.get('/services').then(r => setCatalog(r.data.data || [])).catch(() => {}) }, [])

  const isDraft = proposal?.status === 'DRAFT'

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0)
    const discountAmount = form.discountType === 'PERCENT' ? subtotal * (form.discount / 100) : form.discount
    const afterDiscount = Math.max(0, subtotal - discountAmount)
    const gstAmount = form.gstApplicable ? afterDiscount * (form.gstRate / 100) : 0
    const totalAmount = afterDiscount + gstAmount
    return { subtotal, discountAmount, gstAmount, totalAmount }
  }, [items, form.discount, form.discountType, form.gstApplicable, form.gstRate])

  const addItem = () => setItems(prev => [...prev, { id: crypto.randomUUID(), serviceName: '', description: '', quantity: 1, unitPrice: 0 }])
  const removeItem = (itemId: string) => setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== itemId) : prev)
  const updateItem = (itemId: string, patch: Partial<Item>) => setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...patch } : i))

  const pickService = (itemId: string, value: string) => {
    if (!value) return
    const [type, refId] = value.split(':')
    if (type === 'catalog') {
      const c = catalog.find((x: any) => x.id === refId)
      if (c) updateItem(itemId, { serviceId: c.id, serviceName: c.name, description: c.description || '', unitPrice: c.basePrice })
    }
  }

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    if (isDraft && items.some(i => !i.description.trim() || i.quantity <= 0 || i.unitPrice < 0)) {
      toast.error('Complete all items — description, quantity, price'); return
    }
    setSaving(true)
    try {
      const payload: any = {
        title: form.title,
        notes: form.notes,
        terms: form.terms,
        validUntil: form.validUntil || null,
      }
      if (isDraft) {
        payload.discount = Number(form.discount) || 0
        payload.discountType = form.discountType
        payload.gstApplicable = form.gstApplicable
        payload.gstRate = Number(form.gstRate) || 18
        payload.items = items.map(i => ({
          serviceId: i.serviceId, serviceName: i.serviceName, description: i.description,
          quantity: i.quantity, unitPrice: i.unitPrice,
        }))
      }
      await api.put(`/proposals/${id}`, payload)
      toast.success('Proposal updated!')
      router.push(`/proposals/${id}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Update failed')
    } finally { setSaving(false) }
  }

  const [unlocking, setUnlocking] = useState(false)
  const moveToDraft = async () => {
    if (!confirm('Move this proposal back to Draft so line items, description, discount and GST can be edited? The client will no longer see it as sent until you send it again.')) return
    setUnlocking(true)
    try {
      await api.put(`/proposals/${id}`, { status: 'DRAFT' })
      toast.success('Moved back to Draft — pricing & items are now editable')
      await fetch_()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to move to Draft')
    } finally { setUnlocking(false) }
  }

  if (loading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>

  if (user && !canEdit) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center card p-8">
        <FileText size={40} className="mx-auto text-gray-300 mb-3" />
        <h2 className="font-semibold text-gray-900 mb-1">Not allowed</h2>
        <p className="text-sm text-gray-500">Only Admin and the telecalling head (TL) can edit proposals.</p>
        <Link href={`/proposals/${id}`} className="btn-secondary btn-sm mt-4 inline-flex">Back to proposal</Link>
      </div>
    )
  }

  if (!proposal) return null

  const personName = proposal.client?.clientName || proposal.lead?.clientName
  const companyName = proposal.client?.companyName || proposal.lead?.companyName

  return (
    <div className="space-y-5 mx-auto">
      <Link href={`/proposals/${id}`} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back to proposal
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Proposal</h1>
          <p className="text-sm text-gray-500 mt-1">
            {proposal.proposalNumber} · {companyName} ({personName})
          </p>
        </div>
        <Button onClick={save} loading={saving}><Save size={13} /> Save Changes</Button>
      </div>

      {!isDraft && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2 flex-wrap">
          <Lock size={15} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1 min-w-[200px]">
            Status is <b>{proposal.status}</b> — line items, discount and GST are locked. Only title, notes, terms and valid-until can be edited now. Move it back to Draft to change pricing.
          </span>
          {CAN_EDIT_ROLES.includes(user?.role || '') && (
            <button onClick={moveToDraft} disabled={unlocking}
              className="btn-secondary btn-sm !bg-white !border-amber-300 !text-amber-800 hover:!bg-amber-100 flex-shrink-0">
              {unlocking ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Move to Draft
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Basic Info</h3>
            <div className="space-y-3">
              <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              <Input label="Valid Until" type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Line Items</h3>
              {isDraft && <button onClick={addItem} className="btn-secondary btn-sm"><Plus size={13} /> Add Item</button>}
            </div>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="relative border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                  {isDraft && (
                    <button onClick={() => removeItem(item.id)} disabled={items.length === 1}
                      className="absolute -top-2 -right-2 h-8 w-8 flex items-center justify-center rounded-full bg-white border border-red-100 shadow-sm text-red-500 hover:bg-red-50 hover:shadow transition disabled:opacity-30">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 md:col-span-5">
                      <select disabled={!isDraft} onChange={e => pickService(item.id, e.target.value)} className="input" defaultValue="">
                        <option value="">— Custom item —</option>
                        <optgroup label="Service catalog">
                          {catalog.map((c: any) => <option key={c.id} value={`catalog:${c.id}`}>{c.name} — ₹{c.basePrice}</option>)}
                        </optgroup>
                      </select>
                      <input type="text" disabled={!isDraft} className="input mt-2 text-sm" placeholder="Service name"
                        value={item.serviceName} onChange={e => updateItem(item.id, { serviceName: e.target.value })} />
                    </div>
                    <div className="col-span-12 md:col-span-4">
                      <textarea disabled={!isDraft} className="input" rows={2} placeholder="Description..."
                        value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <input type="number" disabled={!isDraft} className="input text-sm" placeholder="Qty"
                        value={item.quantity} onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })} min={1} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <input type="number" disabled={!isDraft} className="input text-sm" placeholder="Price (₹)"
                        value={item.unitPrice} onChange={e => updateItem(item.id, { unitPrice: Number(e.target.value) })} min={0} />
                      <p className="text-xs text-gray-500 text-right mt-1 tabular-nums">= ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Notes & Terms</h3>
            <div className="space-y-3">
              <Textarea label="Notes (visible to client)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
              <Textarea label="Terms & Conditions" value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={3} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 sticky top-4">
            <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Discount</label>
                <div className="flex gap-2">
                  <input type="number" disabled={!isDraft} className="input text-sm flex-1" value={form.discount}
                    onChange={e => setForm(p => ({ ...p, discount: Number(e.target.value) }))} min={0} />
                  <select disabled={!isDraft} className="input text-sm w-24" value={form.discountType}
                    onChange={e => setForm(p => ({ ...p, discountType: e.target.value as any }))}>
                    <option value="FIXED">₹</option>
                    <option value="PERCENT">%</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">GST Applicable</label>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" disabled={!isDraft} checked={!form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: false }))} /> No
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" disabled={!isDraft} checked={form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: true }))} /> Yes
                  </label>
                  {form.gstApplicable && (
                    <input type="number" disabled={!isDraft} className="input text-sm w-20 ml-auto" value={form.gstRate}
                      onChange={e => setForm(p => ({ ...p, gstRate: Number(e.target.value) }))} />
                  )}
                  {form.gstApplicable && <span className="text-xs text-gray-500">%</span>}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600"><span>Discount</span><span className="font-medium tabular-nums">−{formatCurrency(totals.discountAmount)}</span></div>
              )}
              {form.gstApplicable && (
                <div className="flex justify-between text-gray-600"><span>GST ({form.gstRate}%)</span><span className="font-medium tabular-nums">{formatCurrency(totals.gstAmount)}</span></div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span><span className="tabular-nums">{formatCurrency(totals.totalAmount)}</span>
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={save} loading={saving} className="w-full"><Save size={13} /> Save Changes</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
