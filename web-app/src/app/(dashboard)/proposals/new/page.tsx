'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { Button, Input, Select, SearchSelect, Textarea } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2, Save, Loader2, Package, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

interface Item {
  id: string
  serviceId?: string
  serviceKey?: string // '' or missing = custom typed name; 'client:<id>' / 'catalog:<id>' = picked from dropdown
  serviceName: string
  description: string
  quantity: number
  unitPrice: number
}

function BuilderPageInner() {
  const router = useRouter()
  const params = useSearchParams()
  const preLeadId = params.get('leadId')

  const [leadLabel, setLeadLabel] = useState('')
  const [catalog, setCatalog] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    leadId: preLeadId || '',
    notes: '',
    terms: 'Payment due within 15 days of acceptance. All prices in INR.',
    validUntil: '',
    discount: 0,
    discountType: 'FIXED' as 'FIXED' | 'PERCENT',
    gstApplicable: false,
    gstRate: 18,
  })

  const [items, setItems] = useState<Item[]>([{
    id: crypto.randomUUID(), serviceName: '', description: '', quantity: 1, unitPrice: 0,
  }])
  // Once the user manually touches items (edits/adds/removes), stop auto-filling
  // them so we never silently overwrite their work when the lead changes again.
  const itemsEditedByUserRef = useRef(false)

  useEffect(() => {
    api.get('/services').then(r => setCatalog(r.data.data || [])).catch(() => { })
    // Resolve the label for a pre-filled lead (came via ?leadId= from the
    // Lead detail page's "New Proposal" button) — search API is used for
    // everything else, so we don't load the whole leads list here.
    if (preLeadId) {
      api.get(`/leads/${preLeadId}`)
        .then(r => setLeadLabel(`${r.data.data.leadNumber} · ${r.data.data.clientName}`))
        .catch(() => { })
    }
  }, [preLeadId])

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0)
    const discountAmount = form.discountType === 'PERCENT' ? subtotal * (form.discount / 100) : form.discount
    const afterDiscount = Math.max(0, subtotal - discountAmount)
    const gstAmount = form.gstApplicable ? afterDiscount * (form.gstRate / 100) : 0
    const totalAmount = afterDiscount + gstAmount
    return { subtotal, discountAmount, afterDiscount, gstAmount, totalAmount }
  }, [items, form.discount, form.discountType, form.gstApplicable, form.gstRate])

  const addItem = () => {
    itemsEditedByUserRef.current = true
    setItems(prev => [
      ...prev, { id: crypto.randomUUID(), serviceName: '', description: '', quantity: 1, unitPrice: 0 },
    ])
  }

  const removeItem = (id: string) => {
    itemsEditedByUserRef.current = true
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev)
  }

  const updateItem = (id: string, patch: Partial<Item>) => {
    itemsEditedByUserRef.current = true
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  // value is "" (custom) or "catalog:<serviceCatalogId>"
  const pickService = (id: string, value: string) => {
    if (!value) {
      // switched to "Custom item" — keep whatever name is there, just let them type it
      updateItem(id, { serviceKey: '' })
      return
    }
    const [type, refId] = value.split(':')
    if (type === 'catalog') {
      const c = catalog.find((x: any) => x.id === refId)
      if (c) {
        updateItem(id, {
          serviceKey: value,
          serviceId: c.id,
          serviceName: c.name,
          description: c.description || '',
          unitPrice: c.basePrice,
        })
      }
    }
  }

  const save = async (sendAfter = false) => {
    if (!form.title.trim()) { toast.error('Title required'); return }
    if (!form.leadId) { toast.error('Select a lead'); return }
    if (items.some(i => !i.description.trim() || i.quantity <= 0 || i.unitPrice < 0)) {
      toast.error('Complete all items — description, quantity, price'); return
    }

    setSaving(true)
    try {
      const r = await api.post('/proposals', {
        title: form.title,
        leadId: form.leadId,
        notes: form.notes,
        terms: form.terms,
        validUntil: form.validUntil || null,
        discount: Number(form.discount) || 0,
        discountType: form.discountType,
        gstApplicable: form.gstApplicable,
        gstRate: Number(form.gstRate) || 18,
        items: items.map(i => ({
          serviceId: i.serviceId,
          serviceName: i.serviceName,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      })
      const proposalId = r.data.data.id
      toast.success('Proposal created!')
      if (sendAfter) {
        try {
          await api.post(`/proposals/${proposalId}/send`, { viaEmail: true, viaWhatsapp: true })
          toast.success('Sent via email + WhatsApp')
        } catch { toast.error('Created but sending failed') }
      }
      router.push(`/proposals/${proposalId}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5 mx-auto">
      <Link href="/proposals" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back to proposals
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Proposal</h1>
          <p className="text-sm text-gray-500 mt-1">Create a proposal — items, discount, GST all live-calculated</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => save(false)} loading={saving}><Save size={13} /> Save Draft</Button>
          <Button onClick={() => save(true)} loading={saving}>Save & Send</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Basic Info</h3>
            <div className="space-y-3">
              <Input label="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Website + SEO Package Q1 2026" />
              <div className="grid grid-cols-2 gap-3">
                <SearchSelect
                  label="Lead *"
                  placeholder="Search lead by name, company, phone, lead#..."
                  value={form.leadId}
                  valueLabel={leadLabel}
                  onSelect={(id, label) => { setForm(p => ({ ...p, leadId: id })); setLeadLabel(label) }}
                  fetchOptions={async (q) => {
                    const r = await api.get(`/leads?search=${encodeURIComponent(q)}&limit=20`)
                    return (r.data.data || []).map((l: any) => ({ value: l.id, label: `${l.leadNumber} · ${l.clientName}` }))
                  }}
                />

                <Input label="Valid Until" type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Line Items</h3>
              <button onClick={addItem} className="btn-secondary btn-sm"><Plus size={13} /> Add Item</button>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50"
                >
                  {/* Delete Button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="absolute -top-2 -right-2 h-8 w-8 flex items-center justify-center rounded-full bg-white border border-red-100 shadow-sm text-red-500 hover:bg-red-50 hover:shadow transition disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 md:col-span-5">
                      <select
                        value={item.serviceKey || ''}
                        onChange={e => pickService(item.id, e.target.value)}
                        className="input"
                      >
                        <option value="">— Custom item —</option>

                        <optgroup label="Service catalog">
                          {catalog.map((c: any) => (
                            <option key={c.id} value={`catalog:${c.id}`}>
                              {c.name} — ₹{c.basePrice}
                            </option>
                          ))}
                        </optgroup>
                      </select>

                      {!item.serviceKey && (
                        <input
                          type="text"
                          className="input mt-2 text-sm"
                          placeholder="Service name (e.g. Website Design)"
                          value={item.serviceName}
                          onChange={e =>
                            updateItem(item.id, { serviceName: e.target.value })
                          }
                        />
                      )}
                    </div>

                    <div className="col-span-12 md:col-span-4">
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Description of what's included..."
                        value={item.description}
                        onChange={e =>
                          updateItem(item.id, { description: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-span-4 md:col-span-1">
                      <input
                        type="number"
                        className="input text-sm"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e =>
                          updateItem(item.id, { quantity: Number(e.target.value) })
                        }
                        min={1}
                      />
                    </div>

                    <div className="col-span-6 md:col-span-2">
                      <input
                        type="number"
                        className="input text-sm"
                        placeholder="Price (₹)"
                        value={item.unitPrice}
                        onChange={e =>
                          updateItem(item.id, { unitPrice: Number(e.target.value) })
                        }
                        min={0}
                      />

                      <p className="text-xs text-gray-500 text-right mt-1 tabular-nums">
                        = ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes + terms */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Notes & Terms</h3>
            <div className="space-y-3">
              <Textarea label="Notes (visible to client)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
              <Textarea label="Terms & Conditions" value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={3} />
            </div>
          </div>
        </div>

        {/* Right sticky panel — totals + settings */}
        <div className="space-y-4">
          <div className="card p-5 sticky top-4">
            <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>

            {/* Discount */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Discount</label>
                <div className="flex gap-2">
                  <input type="number" className="input text-sm flex-1" value={form.discount}
                    onChange={e => setForm(p => ({ ...p, discount: Number(e.target.value) }))} min={0} />
                  <select className="input text-sm w-24" value={form.discountType}
                    onChange={e => setForm(p => ({ ...p, discountType: e.target.value as any }))}>
                    <option value="FIXED">₹</option>
                    <option value="PERCENT">%</option>
                  </select>
                </div>
              </div>

              {/* GST */}
              <div>
                <label className="label">GST Applicable</label>
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" checked={!form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: false }))} /> No
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" checked={form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: true }))} /> Yes
                  </label>
                  {form.gstApplicable && (
                    <input type="number" className="input text-sm w-20 ml-auto" value={form.gstRate}
                      onChange={e => setForm(p => ({ ...p, gstRate: Number(e.target.value) }))} />
                  )}
                  {form.gstApplicable && <span className="text-xs text-gray-500">%</span>}
                </div>
              </div>
            </div>

            {/* Live totals */}
            <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount ({form.discountType === 'PERCENT' ? `${form.discount}%` : ''})</span>
                  <span className="font-medium tabular-nums">−{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              {form.gstApplicable && (
                <div className="flex justify-between text-gray-600">
                  <span>GST ({form.gstRate}%)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(totals.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(totals.totalAmount)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Button onClick={() => save(true)} loading={saving} className="w-full">
                Save & Send to Client
              </Button>
              <Button variant="secondary" onClick={() => save(false)} loading={saving} className="w-full">
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProposalNewPage() {
  return <Suspense fallback={<Loader2 className="animate-spin mx-auto mt-12 text-gray-400" />}><BuilderPageInner /></Suspense>
}