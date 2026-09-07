// src/app/seo-report/view/[token]/page.tsx
// Public "view SEO report" page — no login required, the unguessable share
// token is the access control (mirrors /proposal/view/[token]).
// The PDF is built right here in the visitor's browser with the same jsPDF
// code the admin builder uses (src/lib/seoReportPdf.ts) — nothing is ever
// uploaded to storage, so this link never fills up Cloudinary.
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { buildSeoReportDataUrl, downloadSeoReportPdf, SeoReportData, SeoReportMeta } from '@/lib/seoReportPdf'
import { Download, AlertCircle, Loader2 } from 'lucide-react'

export default function SeoReportViewPage() {
  const params = useParams()
  const token = params.token as string
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<SeoReportMeta | null>(null)
  const [data, setData] = useState<SeoReportData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/seo-reports/view/${token}`)
      .then(r => r.json())
      .then(async d => {
        if (d.error) { setError(d.error); return }
        setMeta(d.data.meta)
        setData(d.data.data)
        const url = await buildSeoReportDataUrl(d.data.meta, d.data.data)
        setPdfUrl(url)
      })
      .catch(() => setError('Failed to load report'))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <AlertCircle size={32} className="text-red-400 mb-2" />
        <p className="text-gray-600">{error}</p>
      </div>
    )
  }

  if (!pdfUrl || !meta || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <Loader2 size={26} className="animate-spin text-gray-400 mb-2" />
        <p className="text-gray-500 text-sm">Building your report…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <p className="text-sm font-medium text-gray-700 truncate">
          {meta.businessName} — SEO/GMB Report ({meta.reportMonth})
        </p>
        <button
          onClick={() => downloadSeoReportPdf(meta, data)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
        >
          <Download size={13} /> Download
        </button>
      </div>
      <iframe src={pdfUrl} className="flex-1 w-full" title="SEO Report" />
    </div>
  )
}
