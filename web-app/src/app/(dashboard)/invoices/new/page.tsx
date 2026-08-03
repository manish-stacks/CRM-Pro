'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/axios'
import { Button, Input, Select, SearchSelect, Textarea } from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Item { id: string; serviceKey?: string; serviceName: string; description: string; quantity: number; unitPrice: number }

function InvoiceBuilderInner() {
  const router = useRouter()
  const params = useSearchParams()
  const preClientId = params.get('clientId')

  const [clientLabel, setClientLabel] = useState('')
  const [catalog, setCatalog] = useState<any[]>([])
  const [clientServices, setClientServices] = useState<any[]>([])
  const [loadingClientServices, setLoadingClientServices] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    clientId: preClientId || '',
    notes: '',
    terms: 'Payment due within 15 days. Late fee of 2% per month applicable.',
    dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0] })(),
    discount: 0,
    discountType: 'FIXED' as 'FIXED' | 'PERCENT',
    gstApplicable: false,
    gstRate: 18,
  })

  const [items, setItems] = useState<Item[]>([{
    id: crypto.randomUUID(), serviceName: '', description: '', quantity: 1, unitPrice: 0,
  }])
  // Once the user manually touches items (edits/adds/removes), stop auto-filling
  // them so we never silently overwrite their work when the client changes again.
  const itemsEditedByUserRef = useRef(false)

  useEffect(() => {
    api.get('/services').then(r => setCatalog(r.data.data || [])).catch(() => { })
    // Resolve label + GST default for a pre-filled client (came via
    // ?clientId= from the Client detail page's "New Invoice" button).
    if (preClientId) {
      api.get(`/clients/${preClientId}`).then(r => {
        const c = r.data.data
        setClientLabel(`${c.clientName} — ${c.companyName}`)
        if (c.gstApplicable) setForm(p => ({ ...p, gstApplicable: true }))
      }).catch(() => { })
    }
  }, [preClientId])

  // Fetch the selected client's already-assigned services so they can be
  // picked directly in line items (auto-fills name/price from what's on the client).
  useEffect(() => {
    if (!form.clientId) { setClientServices([]); return }
    setLoadingClientServices(true)
    api.get(`/clients/${form.clientId}/services`)
      .then(r => setClientServices(r.data.data || []))
      .catch(() => setClientServices([]))
      .finally(() => setLoadingClientServices(false))
  }, [form.clientId])

  // Auto-fill the whole Line Items section from the client's active services
  // as soon as they're loaded — only if the user hasn't started editing items
  // themselves, so we never stomp on manual work.
  useEffect(() => {
    if (!form.clientId || loadingClientServices) return
    if (itemsEditedByUserRef.current) return

    const active = clientServices.filter((cs: any) => cs.status === 'ACTIVE')
    if (active.length > 0) {
      setItems(active.map((cs: any) => ({
        id: crypto.randomUUID(),
        serviceKey: `client:${cs.id}`,
        serviceName: cs.serviceName,
        description: cs.description || cs.serviceName,
        quantity: 1,
        unitPrice: Number(cs.amount) || 0,
      })))
    }
  }, [clientServices, loadingClientServices, form.clientId])

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0)
    const discountAmount = form.discountType === 'PERCENT' ? subtotal * (form.discount / 100) : form.discount
    const afterDiscount = Math.max(0, subtotal - discountAmount)
    const gstAmount = form.gstApplicable ? afterDiscount * (form.gstRate / 100) : 0
    const totalAmount = afterDiscount + gstAmount
    return { subtotal, discountAmount, gstAmount, totalAmount }
  }, [items, form.discount, form.discountType, form.gstApplicable, form.gstRate])

  const addItem = () => {
    itemsEditedByUserRef.current = true
    setItems(prev => [...prev, { id: crypto.randomUUID(), serviceName: '', description: '', quantity: 1, unitPrice: 0 }])
  }
  const removeItem = (id: string) => {
    itemsEditedByUserRef.current = true
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev)
  }
  const updateItem = (id: string, patch: Partial<Item>) => {
    itemsEditedByUserRef.current = true
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }
  // value is "" (custom), "client:<clientServiceId>" or "catalog:<serviceCatalogId>"
  const pickService = (id: string, value: string) => {
    if (!value) {
      updateItem(id, { serviceKey: '' })
      return
    }
    const [type, refId] = value.split(':')
    if (type === 'client') {
      const cs = clientServices.find((x: any) => x.id === refId)
      if (cs) {
        updateItem(id, {
          serviceKey: value,
          serviceName: cs.serviceName,
          description: cs.description || cs.serviceName,
          unitPrice: Number(cs.amount) || 0,
        })
      }
    } else if (type === 'catalog') {
      const c = catalog.find((x: any) => x.id === refId)
      if (c) {
        updateItem(id, { serviceKey: value, serviceName: c.name, description: c.description || '', unitPrice: c.basePrice })
      }
    }
  }

  const onClientChange = (cid: string, label: string) => {
    setForm(p => ({ ...p, clientId: cid }))
    setClientLabel(label)
    api.get(`/clients/${cid}`).then(r => {
      const c = r.data.data
      if (c && c.gstApplicable !== form.gstApplicable) {
        setForm(p => ({ ...p, clientId: cid, gstApplicable: c.gstApplicable }))
      }
    }).catch(() => { })
  }

  const save = async (sendAfter = false) => {
    if (!form.clientId) { toast.error('Select a client'); return }
    if (items.some(i => !i.description.trim() || i.quantity <= 0)) {
      toast.error('Complete all items'); return
    }
    setSaving(true)
    try {
      const r = await api.post('/invoices', {
        clientId: form.clientId,
        notes: form.notes,
        terms: form.terms,
        dueDate: form.dueDate,
        discount: form.discount,
        discountType: form.discountType,
        gstApplicable: form.gstApplicable,
        gstRate: form.gstRate,
        items: items.map(i => ({ serviceName: i.serviceName, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      })
      const invId = r.data.data.id
      toast.success('Invoice created!')
      if (sendAfter) {
        try { await api.post(`/invoices/${invId}/send`, { viaEmail: true, viaWhatsapp: true }); toast.success('Sent') } catch { }
      }
      router.push(`/invoices/${invId}`)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <Link href="/invoices" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
        <ArrowLeft size={13} /> Back to invoices
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
          <p className="text-sm text-gray-500 mt-1">Live totals with GST + discount calculation</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => save(false)} loading={saving}><Save size={13} /> Save</Button>
          <Button onClick={() => save(true)} loading={saving}>Save & Send</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Basic Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <SearchSelect
                label="Client *"
                placeholder="Search client by name, company, phone..."
                value={form.clientId}
                valueLabel={clientLabel}
                onSelect={(id, label) => onClientChange(id, label)}
                fetchOptions={async (q) => {
                  const r = await api.get(`/clients?search=${encodeURIComponent(q)}&limit=20`)
                  return (r.data.data || []).map((c: any) => ({ value: c.id, label: `${c.clientName} — ${c.companyName}` }))
                }}
              />

              <Input label="Due Date" type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Line Items</h3>
              <button onClick={addItem} className="btn-secondary btn-sm"><Plus size={13} /> Add Item</button>
            </div>
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className="relative border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50"
                >
                  {/* Delete Button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="absolute -top-2 -right-2 h-8 w-8 flex items-center justify-center rounded-full bg-white border border-red-100 shadow-sm text-red-500 hover:bg-red-50 hover:shadow transition disabled:opacity-30"
                    title="Remove Item"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="grid grid-cols-12 gap-2">
                    {/* Service */}
                    <div className="col-span-12 md:col-span-5">
                      <select
                        value={item.serviceKey || ''}
                        onChange={e => pickService(item.id, e.target.value)}
                        className="input"
                      >
                        <option value="">— Custom item —</option>

                        {form.clientId && (
                          <optgroup
                            label={
                              loadingClientServices
                                ? "Loading client services…"
                                : "Client's services"
                            }
                          >
                            {clientServices.map((cs: any) => (
                              <option key={cs.id} value={`client:${cs.id}`}>
                                {cs.serviceName} — ₹
                                {Number(cs.amount).toLocaleString("en-IN")} ({cs.status})
                              </option>
                            ))}

                            {!loadingClientServices &&
                              clientServices.length === 0 && (
                                <option disabled value="">
                                  No services on this client yet
                                </option>
                              )}
                          </optgroup>
                        )}

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
                          placeholder="Service name"
                          value={item.serviceName}
                          onChange={e =>
                            updateItem(item.id, {
                              serviceName: e.target.value,
                            })
                          }
                        />
                      )}
                    </div>

                    {/* Description */}
                    <div className="col-span-12 md:col-span-4">
                      <textarea
                        className="input"
                        rows={2}
                        placeholder="Description..."
                        value={item.description}
                        onChange={e =>
                          updateItem(item.id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 md:col-span-1">
                      <input
                        type="number"
                        className="input text-sm"
                        placeholder="Qty"
                        value={item.quantity}
                        min={1}
                        onChange={e =>
                          updateItem(item.id, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </div>

                    {/* Price */}
                    <div className="col-span-6 md:col-span-2">
                      <input
                        type="number"
                        className="input text-sm"
                        placeholder="₹"
                        value={item.unitPrice}
                        min={0}
                        onChange={e =>
                          updateItem(item.id, {
                            unitPrice: Number(e.target.value),
                          })
                        }
                      />

                      <p className="text-xs text-gray-500 text-right mt-1 tabular-nums">
                        = ₹
                        {(item.quantity * item.unitPrice).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Notes & Terms</h3>
            <div className="space-y-3">
              <Textarea label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              <Textarea label="Terms" value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={3} />
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
                  <input type="number" className="input text-sm flex-1" value={form.discount}
                    onChange={e => setForm(p => ({ ...p, discount: Number(e.target.value) }))} min={0} />
                  <select className="input text-sm w-24" value={form.discountType}
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
                    <input type="radio" checked={!form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: false }))} /> No
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="radio" checked={form.gstApplicable} onChange={() => setForm(p => ({ ...p, gstApplicable: true }))} /> Yes
                  </label>
                  {form.gstApplicable && (
                    <>
                      <input type="number" className="input text-sm w-20 ml-auto" value={form.gstRate}
                        onChange={e => setForm(p => ({ ...p, gstRate: Number(e.target.value) }))} />
                      <span className="text-xs text-gray-500">%</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
              {totals.discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span className="tabular-nums">−{formatCurrency(totals.discountAmount)}</span></div>}
              {form.gstApplicable && <div className="flex justify-between text-gray-600"><span>GST ({form.gstRate}%)</span><span className="tabular-nums">{formatCurrency(totals.gstAmount)}</span></div>}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200"><span>Total</span><span className="tabular-nums">{formatCurrency(totals.totalAmount)}</span></div>
            </div>

            <div className="mt-4 space-y-2">
              <Button onClick={() => save(true)} loading={saving} className="w-full">Save & Send</Button>
              <Button variant="secondary" onClick={() => save(false)} loading={saving} className="w-full">Save Only</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvoiceNewPage() {
  return <Suspense fallback={<Loader2 className="animate-spin mx-auto mt-12 text-gray-400" />}><InvoiceBuilderInner /></Suspense>
}