'use client'
import { useState, useEffect, useCallback } from 'react'
import { Button, Modal, Input, Select, Textarea, EmptyState, Badge } from '@/components/ui'
import { Plus, Edit, Trash2, Package, Tag, DollarSign, Building2, UserCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import api from '@/lib/axios'
import toast from 'react-hot-toast'

interface Service {
  id: string
  name: string
  description?: string
  category?: string
  departmentId?: string | null
  basePrice: number
  billingCycle?: string
  isActive: boolean
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', description: '', category: '', departmentId: '', basePrice: '', billingCycle: 'ONE_TIME' })

  // Department map so each catalog card can show its handling dept + head (TL)
  const deptById = Object.fromEntries(departments.map((d: any) => [d.id, d]))

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/services')
      setServices(r.data.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data.data || [])).catch(() => { })
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', description: '', category: '', departmentId: '', basePrice: '', billingCycle: 'ONE_TIME' })
    setShowModal(true)
  }
  const openEdit = (s: Service) => {
    setEditing(s)
    setForm({
      name: s.name, description: s.description || '', category: s.category || '',
      departmentId: s.departmentId || '', basePrice: String(s.basePrice),
      billingCycle: s.billingCycle || 'ONE_TIME',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name) { toast.error('Name required'); return }
    // Department decides which team head (TL) gets auto-assigned when this
    // service is added to a client, so it is required.
    if (!form.departmentId) { toast.error('Select the handling department'); return }
    setSaving(true)
    try {
      const data = { ...form, basePrice: Number(form.basePrice) || 0 }
      if (editing) {
        await api.put(`/services/${editing.id}`, data)
        toast.success('Updated!')
      } else {
        await api.post('/services', data)
        toast.success('Created!')
      }
      setShowModal(false)
      fetch()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this service?')) return
    await api.delete(`/services/${id}`)
    toast.success('Deleted')
    fetch()
  }

  const toggle = async (s: Service) => {
    await api.put(`/services/${s.id}`, { isActive: !s.isActive })
    toast.success(s.isActive ? 'Deactivated' : 'Activated')
    fetch()
  }

  const categories = [...new Set(services.map(s => s.category).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Catalog</h1>
          <p className="text-sm text-gray-500">{services.length} services · Used in client service assignments</p>
        </div>
        <Button variant="primary" onClick={openAdd}><Plus size={16} />Add Service</Button>
      </div>

      {/* Category groups */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : services.length === 0 ? (
        <EmptyState title="No services" description="Add services to use in client assignments" icon={<Package size={28} />} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(svc => (
            <div key={svc.id} className={`card p-5 ${!svc.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Package size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{svc.name}</h3>
                    {svc.category && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Tag size={10} />{svc.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="p-1.5" onClick={() => openEdit(svc)}><Edit size={13} /></Button>
                  <Button variant="danger" size="sm" className="p-1.5" onClick={() => del(svc.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
              {svc.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{svc.description}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {svc.departmentId && deptById[svc.departmentId] ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">
                      <Building2 size={10} />{deptById[svc.departmentId].name}
                    </span>
                    {deptById[svc.departmentId]?.manager?.user?.name && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 rounded px-1.5 py-0.5">
                        <UserCheck size={10} />TL: {deptById[svc.departmentId].manager.user.name}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">No department set</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-base font-bold text-green-600">
                  {formatCurrency(svc.basePrice)}
                </div>
                <button
                  onClick={() => toggle(svc)}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${svc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {svc.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Service' : 'New Service'} className="max-w-md">
        <div className="space-y-4">
          <Input label="Service Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. SEO Package, Web Hosting" />
          <Input label="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Digital Marketing, IT" list="cats" />
          <datalist id="cats">{categories.map(c => <option key={c!} value={c!} />)}</datalist>
          <Select
            label="Handling Department *"
            value={form.departmentId}
            onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}
            options={[{ value: '', label: 'Select department' }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))]}
          />
          {form.departmentId && deptById[form.departmentId]?.manager?.user?.name && (
            <p className="-mt-2 text-[11px] text-gray-500">
              Team lead <b>{deptById[form.departmentId].manager.user.name}</b> will be auto-assigned as project head whenever this service is given to a client.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Base Price (₹)" type="number" value={form.basePrice} onChange={e => setForm(p => ({ ...p, basePrice: e.target.value }))} placeholder="0" />
            <Select label="Billing Cycle" value={form.billingCycle} onChange={e => setForm(p => ({ ...p, billingCycle: e.target.value }))}
              options={['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map(c => ({ value: c, label: c }))} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description..." rows={3} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={saving}>{editing ? 'Update' : 'Add Service'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
