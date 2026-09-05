'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, Textarea, Modal, Spinner } from '@/components/ui'
import {
  ArrowLeft, Plus, Trash2, Save, Eye, Send, ImagePlus, X, Loader2,
  CheckCircle2, FileEdit, Building2, Link2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { openSeoReportPdf, buildSeoReportDataUrl, SeoReportData } from '@/lib/seoReportPdf'


const DEFAULT_WORK = [
  'On-page optimisation of all pages (Meta tags, Heading Tags, Image optimisation)',
  'Content written and optimised for the website pages',
  'Technical SEO (errors fixed)',
  'Search Console indexing of URLs',
  'Off-page and backlink work',
  'GMB Posting and optimization',
]

const EMPTY: SeoReportData = {
  clientLogo: null,
  gmbScreenshot: null,
  gmbOverview: '', gmbCalls: '', gmbChats: '', gmbDirections: '', gmbWebsiteClicks: '',
  gmbNote: '',
  gmbPosts: [], localCitations: [], gmbKeywords: [],
  technicalWork: DEFAULT_WORK,
  gscScreenshot: null, gaScreenshot: null,
  pages: [], blogs: [],
  profileCreation: [], forumSubmission: [], classifiedAds: [], businessListings: [],
  web20: [], articles: [],
  websiteKeywords: [],
  companyLogo: null,
}

// ------------------------------------------------------------------ helpers
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(String(fr.result))
    fr.onerror = rej
    fr.readAsDataURL(file)
  })
}

function Card({ title, desc, children, right }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {desc && <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function ImageBox({ label, hint, value, onChange, disabled }: {
  label: string; hint?: string; value?: string | null; onChange: (url: string | null) => void | Promise<void>; disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error('Max 5MB')
    setBusy(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      const r = await api.post('/upload', { dataUrl, folder: 'client-reports', resourceType: 'image' })
      await onChange(r.data.data.url || r.data.data.secure_url)
      toast.success('Uploaded')
    } catch { toast.error('Upload failed') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="-mt-1 mb-1 text-[11px] text-gray-500">{hint}</p>}
      {value ? (
        <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full max-h-56 object-contain" />
          {!disabled && (
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <label className="bg-white/90 border border-gray-200 rounded px-1.5 py-1 text-[10px] text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-1">
                {busy ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />} Replace
                <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
              </label>
              <button onClick={() => onChange(null)} type="button"
                className="bg-white/90 border border-gray-200 rounded p-1 text-red-600 hover:bg-red-50">
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg py-6 text-xs
          ${disabled ? 'border-gray-200 text-gray-300' : 'border-gray-300 text-gray-500 hover:border-brand-400 cursor-pointer'}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          <span>{busy ? 'Uploading…' : 'Upload screenshot'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={disabled || busy} />
        </label>
      )}
    </div>
  )
}

function LinkRows({ label, rows, onChange, disabled, placeholder = 'https://...' }: {
  label: string; rows: any[]; onChange: (r: any[]) => void; disabled?: boolean; placeholder?: string
}) {
  const set = (i: number, key: string, v: string) => {
    const next = [...rows]; next[i] = { ...next[i], [key]: v }; onChange(next)
  }
  const bulk = () => {
    const text = prompt(`Paste multiple ${label} links (one per line)`)
    if (!text) return
    const added = text.split(/\r?\n/).map(t => t.trim()).filter(Boolean).map(url => ({ url, status: 'Live' }))
    onChange([...rows, ...added])
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">{label} <span className="text-gray-400">({rows.length})</span></span>
        {!disabled && (
          <div className="flex gap-1.5">
            <button type="button" onClick={bulk} className="text-[11px] text-brand-600 hover:underline">Bulk paste</button>
            <button type="button" onClick={() => onChange([...rows, { url: '', status: 'Live' }])}
              className="text-[11px] text-brand-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> Add</button>
          </div>
        )}
      </div>
      {rows.length === 0 && <p className="text-[11px] text-gray-400">No entries.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <span className="text-[11px] text-gray-400 w-5 shrink-0">{i + 1}</span>
          <input className="input flex-1 text-xs" placeholder={placeholder} value={r.url || ''}
            onChange={e => set(i, 'url', e.target.value)} disabled={disabled} />
          <input className="input w-20 text-xs" placeholder="Live" value={r.status || ''}
            onChange={e => set(i, 'status', e.target.value)} disabled={disabled} />
          {!disabled && (
            <button type="button" onClick={() => onChange(rows.filter((_, x) => x !== i))}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
          )}
        </div>
      ))}
    </div>
  )
}

function KeywordRows({ label, rows, onChange, disabled }: {
  label: string; rows: any[]; onChange: (r: any[]) => void; disabled?: boolean
}) {
  const set = (i: number, key: string, v: string) => {
    const next = [...rows]; next[i] = { ...next[i], [key]: v }; onChange(next)
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">{label} <span className="text-gray-400">({rows.length})</span></span>
        {!disabled && (
          <button type="button" onClick={() => onChange([...rows, { keyword: '', position: '' }])}
            className="text-[11px] text-brand-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> Add</button>
        )}
      </div>
      {rows.length === 0 && <p className="text-[11px] text-gray-400">No keywords.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <span className="text-[11px] text-gray-400 w-5 shrink-0">{i + 1}</span>
          <input className="input flex-1 text-xs" placeholder="Best Institute in Delhi" value={r.keyword || ''}
            onChange={e => set(i, 'keyword', e.target.value)} disabled={disabled} />
          <input className="input w-20 text-xs" placeholder="1" value={r.position ?? ''}
            onChange={e => set(i, 'position', e.target.value)} disabled={disabled} />
          {!disabled && (
            <button type="button" onClick={() => onChange(rows.filter((_, x) => x !== i))}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
          )}
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ page
export default function SeoReportBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAtLeast } = useAuth()

  const [report, setReport] = useState<any>(null)
  const [d, setD] = useState<SeoReportData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitModal, setSubmitModal] = useState(false)
  const [notify, setNotify] = useState({ email: true, whatsapp: true, message: '' })

  const locked = report?.status === 'SUBMITTED' && !isAtLeast('ADMIN')

  const set = <K extends keyof SeoReportData>(k: K, v: SeoReportData[K]) => setD(p => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/seo-reports/${id}`)
      const rep = r.data.data
      setReport(rep)
      setD({ ...EMPTY, ...(rep.data || {}) })
    } catch { toast.error('Failed to load'); router.push('/seo-reports') }
    finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { load() }, [load])

  const meta = {
    businessName: report?.client?.companyName || '',
    agencyName: report?.agencyName || 'Hover Business Services LLP',
    reportMonth: report?.reportMonth || '',
    serviceName: report?.clientService?.serviceName || null,
  }

  const save = async (silent = false) => {
    setSaving(true)
    try {
      await api.put(`/seo-reports/${id}`, { data: d })
      if (!silent) toast.success('Draft saved')
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const preview = async () => {
    const t = toast.loading('Building PDF…')
    try {
      await openSeoReportPdf(meta, d)
      toast.success('Opened in a new tab', { id: t })
    } catch (e: any) { toast.error(e?.message || 'PDF failed', { id: t }) }
  }

  // Client logo + GMB screenshot are stored on the CLIENT, not the report —
  // uploaded once, reused every month, replaced (never duplicated) here.
  const saveClientAsset = async (key: 'clientLogo' | 'gmbScreenshot', url: string | null) => {
    set(key, url)
    try {
      await api.put(`/seo-reports/${id}/client-assets`, { [key]: url })
    } catch { toast.error('Could not save to client profile') }
  }

  const submit = async () => {
    setSubmitting(true)
    const t = toast.loading('Generating PDF…')
    try {
      await api.put(`/seo-reports/${id}`, { data: d })

      const dataUrl = await buildSeoReportDataUrl(meta, d)
      toast.loading('Uploading…', { id: t })
      const up = await api.post('/upload', { dataUrl, folder: 'client-reports', resourceType: 'raw' })
      const pdfUrl = up.data.data.url || up.data.data.secure_url

      toast.loading('Sending to client…', { id: t })
      await api.post(`/seo-reports/${id}/submit`, {
        pdfUrl,
        fileSize: up.data.data.bytes,
        notifyEmail: notify.email,
        notifyWhatsapp: notify.whatsapp,
        message: notify.message || undefined,
      })

      toast.success('Submitted — client notified', { id: t })
      setSubmitModal(false)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Submit failed', { id: t })
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={30} /></div>

  return (
    <div className="space-y-4 pb-24">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => router.push('/seo-reports')} className="p-2 rounded-lg hover:bg-gray-100 mt-0.5">
            <ArrowLeft size={17} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{report.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{report.reportNumber}</span>
              <span className="flex items-center gap-1"><Building2 size={12} /> {report.client?.companyName}</span>
              {report.clientService && <span>· {report.clientService.serviceName}</span>}
              <span>· {report.reportMonth}</span>
              {report.status === 'SUBMITTED'
                ? <span className="badge bg-green-100 text-green-700 text-[10px] inline-flex items-center gap-1"><CheckCircle2 size={11} /> Submitted</span>
                : <span className="badge bg-amber-100 text-amber-700 text-[10px] inline-flex items-center gap-1"><FileEdit size={11} /> Draft</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={preview}><Eye size={14} /> Preview PDF</Button>
          {!locked && <Button variant="secondary" onClick={() => save()} loading={saving}><Save size={14} /> Save Draft</Button>}
          {!locked && <Button onClick={() => setSubmitModal(true)}><Send size={14} /> Submit to Client</Button>}
          {report.pdfUrl && (
            <a href={report.pdfUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary"><Link2 size={14} /> Submitted PDF</Button>
            </a>
          )}
        </div>
      </div>

      {locked && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-xs">
          This report was submitted on {new Date(report.submittedAt).toLocaleString('en-IN')} and is now visible on the client dashboard. It is locked for editing.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ---------- cover ---------- */}
        <Card title="Cover" desc="Client logo — uploaded once, reused in every month's report">
          <ImageBox
            label="Client Logo"
            hint="Saved on the client profile. Uploading again replaces the old file."
            value={d.clientLogo}
            onChange={v => saveClientAsset('clientLogo', v)}
            disabled={locked}
          />
          <p className="text-[11px] text-gray-500">
            Agency logo and name come from Settings → Company, so there is nothing to upload here.
          </p>
        </Card>

        {/* ---------- GMB ---------- */}
        <Card title="Google My Business" desc="Profile screenshot + performance numbers">
          <ImageBox
            label="GMB Profile Screenshot"
            hint="One-time upload, saved on the client profile and reused each month."
            value={d.gmbScreenshot}
            onChange={v => saveClientAsset('gmbScreenshot', v)}
            disabled={locked}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input label="GMB Overview" value={String(d.gmbOverview ?? '')} onChange={e => set('gmbOverview', e.target.value)} disabled={locked} />
            <Input label="Calls" value={String(d.gmbCalls ?? '')} onChange={e => set('gmbCalls', e.target.value)} disabled={locked} />
            <Input label="Chats" value={String(d.gmbChats ?? '')} onChange={e => set('gmbChats', e.target.value)} disabled={locked} />
            <Input label="Directions" value={String(d.gmbDirections ?? '')} onChange={e => set('gmbDirections', e.target.value)} disabled={locked} />
            <Input label="Website Clicks" value={String(d.gmbWebsiteClicks ?? '')} onChange={e => set('gmbWebsiteClicks', e.target.value)} disabled={locked} />
          </div>
          <Textarea label="Note (optional)" rows={2} value={d.gmbNote || ''} onChange={e => set('gmbNote', e.target.value)}
            placeholder="The call performance data reflects 1-Aug to 28-Aug." disabled={locked} />
        </Card>

        <Card title="GMB Posting Activity">
          <LinkRows label="GMB Post links" rows={d.gmbPosts || []} onChange={v => set('gmbPosts', v)} disabled={locked} placeholder="https://share.google/..." />
        </Card>

        <Card title="Local Citation — Google Profile" desc="Directory / citation backlinks for the GMB profile">
          <LinkRows label="Local Citation Backlinks" rows={d.localCitations || []} onChange={v => set('localCitations', v)} disabled={locked} />
        </Card>

        <Card title="Google Profile — Keywords Ranking">
          <KeywordRows label="GMB keywords" rows={d.gmbKeywords || []} onChange={v => set('gmbKeywords', v)} disabled={locked} />
        </Card>

        {/* ---------- website SEO ---------- */}
        <Card title="Website SEO — Technical & On-Page Work">
          <div className="space-y-2">
            {(d.technicalWork || []).map((w, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input className="input flex-1 text-xs" value={w} disabled={locked}
                  onChange={e => { const n = [...(d.technicalWork || [])]; n[i] = e.target.value; set('technicalWork', n) }} />
                {!locked && (
                  <button type="button" onClick={() => set('technicalWork', (d.technicalWork || []).filter((_, x) => x !== i))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
            {!locked && (
              <button type="button" onClick={() => set('technicalWork', [...(d.technicalWork || []), ''])}
                className="text-[11px] text-brand-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> Add point</button>
            )}
          </div>
        </Card>

        <Card title="Analytics Screenshots" desc="Search Console + Google Analytics for the period">
          <ImageBox label={`Google Search Console — ${report.reportMonth}`} value={d.gscScreenshot} onChange={v => set('gscScreenshot', v)} disabled={locked} />
          <ImageBox label={`Google Analytics — ${report.reportMonth}`} value={d.gaScreenshot} onChange={v => set('gaScreenshot', v)} disabled={locked} />
        </Card>

        {/* ---------- on-page ---------- */}
        <Card title="On-Page SEO Work">
          <LinkRows label="Website Pages" rows={d.pages || []} onChange={v => set('pages', v)} disabled={locked} />
          <div className="pt-2 border-t border-gray-100" />
          <LinkRows label="Website Blogs" rows={d.blogs || []} onChange={v => set('blogs', v)} disabled={locked} />
        </Card>

        {/* ---------- off-page ---------- */}
        <Card title="Off-Page — Profile Creation">
          <LinkRows label="Profile Creation" rows={d.profileCreation || []} onChange={v => set('profileCreation', v)} disabled={locked} />
        </Card>

        <Card title="Off-Page — Forum Submission">
          <LinkRows label="Forum Submission" rows={d.forumSubmission || []} onChange={v => set('forumSubmission', v)} disabled={locked} />
        </Card>

        <Card title="Off-Page — Classified Ads">
          <LinkRows label="Classified Ads Submissions" rows={d.classifiedAds || []} onChange={v => set('classifiedAds', v)} disabled={locked} />
        </Card>

        <Card title="Off-Page — Business Listings">
          <LinkRows label="Business Listings" rows={d.businessListings || []} onChange={v => set('businessListings', v)} disabled={locked} />
        </Card>

        <Card title="Off-Page — Web 2.0 Submissions">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Web 2.0 <span className="text-gray-400">({(d.web20 || []).length})</span></span>
              {!locked && (
                <button type="button" onClick={() => set('web20', [...(d.web20 || []), { website: '', url: '', status: 'Live' }])}
                  className="text-[11px] text-brand-600 hover:underline flex items-center gap-0.5"><Plus size={11} /> Add</button>
              )}
            </div>
            {(d.web20 || []).map((r, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input className="input w-28 text-xs" placeholder="wix.com" value={r.website || ''} disabled={locked}
                  onChange={e => { const n = [...(d.web20 || [])]; n[i] = { ...n[i], website: e.target.value }; set('web20', n) }} />
                <input className="input flex-1 text-xs" placeholder="https://..." value={r.url || ''} disabled={locked}
                  onChange={e => { const n = [...(d.web20 || [])]; n[i] = { ...n[i], url: e.target.value }; set('web20', n) }} />
                <input className="input w-20 text-xs" placeholder="Live" value={r.status || ''} disabled={locked}
                  onChange={e => { const n = [...(d.web20 || [])]; n[i] = { ...n[i], status: e.target.value }; set('web20', n) }} />
                {!locked && (
                  <button type="button" onClick={() => set('web20', (d.web20 || []).filter((_, x) => x !== i))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Off-Page — Article Submission">
          <LinkRows label="Article Submission" rows={d.articles || []} onChange={v => set('articles', v)} disabled={locked} />
        </Card>

        <Card title="Website — Keywords Ranking">
          <KeywordRows label="Website keywords" rows={d.websiteKeywords || []} onChange={v => set('websiteKeywords', v)} disabled={locked} />
        </Card>
      </div>

      {/* ---------- submit modal ---------- */}
      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit report to client">
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div><b>Client:</b> {report.client?.companyName}</div>
            <div><b>Email:</b> {report.client?.email || <span className="text-red-500">not set</span>}</div>
            <div><b>WhatsApp:</b> {report.client?.phone || <span className="text-red-500">not set</span>}</div>
            <div><b>Period:</b> {report.reportMonth}</div>
          </div>
          <Textarea label="Message to client (optional)" rows={3} value={notify.message}
            onChange={e => setNotify(p => ({ ...p, message: e.target.value }))}
            placeholder="Short note that goes into the email + portal description" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={notify.email} onChange={e => setNotify(p => ({ ...p, email: e.target.checked }))} />
            Send email with dashboard link
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={notify.whatsapp} onChange={e => setNotify(p => ({ ...p, whatsapp: e.target.checked }))} />
            Send WhatsApp with PDF link
          </label>
          <p className="text-[11px] text-gray-500">
            On submit the PDF is generated, uploaded, pushed to the client dashboard, and this report is locked.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setSubmitModal(false)}>Cancel</Button>
            <Button onClick={submit} loading={submitting}><Send size={14} /> Submit</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
