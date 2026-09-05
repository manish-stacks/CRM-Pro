// src/lib/seoReportPdf.ts
// Dynamic "SEO + GMB Monthly Report" PDF — same layout as the manual Word/PDF
// format the team used to send by hand. Built with jsPDF + autoTable so it runs
// in the browser (admin builder + client portal re-download).
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ---------------------------------------------------------------- types
export interface LinkRow { url: string; status?: string }
export interface Web20Row { website: string; url: string; status?: string }
export interface KeywordRow { keyword: string; position: string | number }

export interface SeoReportData {
  // Cover
  clientLogo?: string | null          // dataURL / https URL
  // GMB
  gmbScreenshot?: string | null
  gmbOverview?: string | number
  gmbCalls?: string | number
  gmbChats?: string | number
  gmbDirections?: string | number
  gmbWebsiteClicks?: string | number
  gmbNote?: string
  gmbPosts?: LinkRow[]
  localCitations?: LinkRow[]
  gmbKeywords?: KeywordRow[]
  // Website SEO
  technicalWork?: string[]
  gscScreenshot?: string | null
  gaScreenshot?: string | null
  // On-page
  pages?: LinkRow[]
  blogs?: LinkRow[]
  // Off-page
  profileCreation?: LinkRow[]
  forumSubmission?: LinkRow[]
  classifiedAds?: LinkRow[]
  businessListings?: LinkRow[]
  web20?: Web20Row[]
  articles?: LinkRow[]
  // Website keywords
  websiteKeywords?: KeywordRow[]
  // Footer
  companyLogo?: string | null
}

export interface SeoReportMeta {
  businessName: string
  agencyName: string
  reportMonth: string
  serviceName?: string | null
}

// ---------------------------------------------------------------- theme
const NAVY: [number, number, number] = [31, 56, 100]
const RED: [number, number, number] = [237, 28, 36]
const BLACK: [number, number, number] = [23, 23, 23]
const GREY: [number, number, number] = [245, 245, 245]

const W = 210
const H = 297
const M = 14                 // content left/right margin
const TOP = 30               // first usable Y under the header bar
const BOTTOM = 274           // last usable Y

// ---------------------------------------------------------------- image helper
/** Fetch any URL (or pass through a dataURL) and return a base64 dataURL. */
export async function toDataUrl(src?: string | null): Promise<string | null> {
  if (!src) return null
  if (src.startsWith('data:')) return src
  try {
    const res = await fetch(src, { mode: 'cors' })
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Resolve every remote image in the payload to a dataURL before rendering. */
export async function preloadReportImages(d: SeoReportData): Promise<SeoReportData> {
  const [clientLogo, gmbScreenshot, gscScreenshot, gaScreenshot, companyLogo] = await Promise.all([
    toDataUrl(d.clientLogo), toDataUrl(d.gmbScreenshot),
    toDataUrl(d.gscScreenshot), toDataUrl(d.gaScreenshot), toDataUrl(d.companyLogo),
  ])
  return { ...d, clientLogo, gmbScreenshot, gscScreenshot, gaScreenshot, companyLogo }
}

function imgSize(doc: jsPDF, dataUrl: string, maxW: number, maxH: number) {
  try {
    const p = doc.getImageProperties(dataUrl)
    const r = Math.min(maxW / p.width, maxH / p.height)
    return { w: p.width * r, h: p.height * r }
  } catch {
    return { w: maxW, h: maxH }
  }
}

// ---------------------------------------------------------------- main
export function generateSeoReportPdf(meta: SeoReportMeta, data: SeoReportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = TOP

  // ---- page chrome (black top bar + red frame) ----
  const chrome = () => {
    doc.setFillColor(...BLACK)
    doc.rect(4, 8, W - 8, 12, 'F')
    doc.setFillColor(...RED)
    doc.rect(4, 8, 2.5, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold').setFontSize(8)
    doc.text(meta.agencyName.toUpperCase(), 12, 15.4)
    doc.setDrawColor(...RED).setLineWidth(0.5)
    doc.rect(6, 22, W - 12, H - 30)
    doc.setTextColor(0, 0, 0)
  }

  const newPage = () => { doc.addPage(); chrome(); y = TOP }
  const need = (h: number) => { if (y + h > BOTTOM) newPage() }

  chrome()

  // ---- section bar (navy) ----
  const sectionBar = (label: string) => {
    need(14)
    doc.setFillColor(...NAVY)
    doc.rect(M, y, W - M * 2, 9, 'F')
    doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(11)
    doc.text(label, M + 4, y + 6.2)
    doc.setTextColor(0, 0, 0)
    y += 14
  }

  const bigHeading = (label: string, color: [number, number, number] = NAVY) => {
    need(16)
    doc.setTextColor(...color).setFont('helvetica', 'bold').setFontSize(18)
    doc.text(label, W / 2, y + 6, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    y += 14
  }

  const subHeading = (label: string, color: [number, number, number] = RED) => {
    need(16)
    doc.setTextColor(...color).setFont('helvetica', 'bold').setFontSize(13)
    doc.text(label, M, y + 4.5)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal').setFontSize(9.5)
    y += 12
  }

  const image = (dataUrl?: string | null, maxH = 95) => {
    if (!dataUrl) return
    const { w, h } = imgSize(doc, dataUrl, W - M * 2 - 10, maxH)
    need(h + 8)
    doc.setDrawColor(215).setLineWidth(0.3)
    doc.rect(M, y, W - M * 2, h + 6)
    try { doc.addImage(dataUrl, (W - w) / 2, y + 3, w, h) } catch { }
    y += h + 12
  }

  // ---- link table (Sr. No | Link | Status) ----
  const linkTable = (rows: LinkRow[] | undefined, header = 'Backlinks') => {
    const list = (rows || []).filter(r => r?.url?.trim())
    if (!list.length) return
    need(24)
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Sr. No', header, 'Status']],
      body: list.map((r, i) => [String(i + 1), r.url, r.status || 'Live']),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', textColor: [40, 60, 130] },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      alternateRowStyles: { fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center', textColor: [30, 30, 30] },
        2: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [30, 30, 30] },
      },
      didDrawPage: () => { },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  const keywordTable = (rows: KeywordRow[] | undefined) => {
    const list = (rows || []).filter(r => r?.keyword?.trim())
    if (!list.length) return
    need(24)
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Sr. No', 'Keywords', 'Position']],
      body: list.map((r, i) => [String(i + 1), r.keyword, String(r.position ?? '')]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.4 },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: GREY },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  // ================================================== COVER
  if (data.clientLogo) {
    const { w, h } = imgSize(doc, data.clientLogo, 90, 50)
    doc.setDrawColor(220).setLineWidth(0.3)
    doc.rect(M + 12, y, W - (M + 12) * 2, h + 10)
    try { doc.addImage(data.clientLogo, (W - w) / 2, y + 5, w, h) } catch { }
    y += h + 18
  }

  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(19)
  const titleLines = doc.splitTextToSize(
    `${meta.businessName} SEO + GMB Monthly Report ${meta.reportMonth}`, W - M * 2 - 20
  )
  doc.text(titleLines, W / 2, y + 6, { align: 'center' })
  y += titleLines.length * 9 + 8
  doc.setTextColor(0, 0, 0)

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    body: [
      ['Business Name', meta.businessName],
      ['Agency', meta.agencyName],
      ['Reporting Period', meta.reportMonth],
      ...(meta.serviceName ? [['Service', meta.serviceName]] : []),
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
  })
  y = (doc as any).lastAutoTable.finalY + 14

  // ================================================== GMB
  bigHeading('Google My Business Report', [0, 0, 0])
  image(data.gmbScreenshot, 110)

  // ---- Local Citation — Google Profile ----
  sectionBar('Local Citation - Google Profile')

  // ---- Performance analytics strip ----
  const stats = [
    { label: 'GMB Overview', value: data.gmbOverview },
    { label: 'Calls', value: data.gmbCalls },
    { label: 'Chats', value: data.gmbChats },
    { label: 'Directions', value: data.gmbDirections },
    { label: 'Website Clicks', value: data.gmbWebsiteClicks },
  ].filter(s => s.value !== undefined && s.value !== '' && s.value !== null)

  if (stats.length) {
    subHeading('Performance Analytics', NAVY)
    need(26)
    const gap = 3
    const boxW = (W - M * 2 - gap * (stats.length - 1)) / stats.length
    stats.forEach((s, i) => {
      const x = M + i * (boxW + gap)
      doc.setFillColor(...GREY)
      doc.setDrawColor(220).setLineWidth(0.3)
      doc.roundedRect(x, y, boxW, 20, 1.5, 1.5, 'FD')
      doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(15)
      doc.text(String(s.value), x + boxW / 2, y + 9, { align: 'center' })
      doc.setTextColor(90).setFont('helvetica', 'normal').setFontSize(6.5)
      doc.text(doc.splitTextToSize(s.label, boxW - 2), x + boxW / 2, y + 15, { align: 'center' })
    })
    doc.setTextColor(0, 0, 0)
    y += 26
    if (data.gmbNote?.trim()) {
      doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(90)
      const noteLines = doc.splitTextToSize(`Note: ${data.gmbNote}`, W - M * 2)
      need(noteLines.length * 4 + 8)
      doc.text(noteLines, M, y + 3)
      doc.setTextColor(0, 0, 0).setFont('helvetica', 'normal')
      y += noteLines.length * 4 + 9
    }
  }

  const posts = (data.gmbPosts || []).filter(p => p?.url?.trim())
  if (posts.length) {
    subHeading(`GMB Posting Activity — ${posts.length} live posts`, NAVY)
    linkTable(posts, 'Posting')
  }

  if (data.localCitations?.some(r => r.url?.trim())) {
    subHeading('Local Citation Backlinks', NAVY)
    linkTable(data.localCitations)
  }

  if (data.gmbKeywords?.length) {
    sectionBar('Google Profile - Keywords Ranking')
    keywordTable(data.gmbKeywords)
  }

  // ================================================== WEBSITE SEO
  const work = (data.technicalWork || []).filter(w => w?.trim())
  if (work.length) {
    sectionBar('Website SEO - Technical & On-Page Work')
    need(work.length * 6 + 6)
    doc.setFont('helvetica', 'normal').setFontSize(9.5)
    work.forEach(item => {
      const lines = doc.splitTextToSize(item, W - M * 2 - 8)
      need(lines.length * 5 + 4)
      doc.circle(M + 2, y + 2.6, 0.8, 'F')
      doc.text(lines, M + 6, y + 4)
      y += lines.length * 5 + 2
    })
    y += 6
  }

  if (data.gscScreenshot) {
    subHeading(`Google Search Console — ${meta.reportMonth}`)
    image(data.gscScreenshot, 100)
  }
  if (data.gaScreenshot) {
    subHeading(`Google Analytics — ${meta.reportMonth}`)
    image(data.gaScreenshot, 100)
  }

  // ================================================== ON-PAGE
  if (data.pages?.some(p => p.url?.trim()) || data.blogs?.some(b => b.url?.trim())) {
    bigHeading('On-Page SEO Work', [0, 0, 0])
    if (data.pages?.some(p => p.url?.trim())) {
      sectionBar('Website Pages')
      linkTable(data.pages, 'Website Pages')
    }
    if (data.blogs?.some(b => b.url?.trim())) {
      sectionBar('Website Blogs')
      linkTable(data.blogs, 'Website Blog')
    }
  }

  // ================================================== OFF-PAGE
  const offSections: Array<[string, LinkRow[] | undefined]> = [
    ['Profile Creation', data.profileCreation],
    ['Forum Submission', data.forumSubmission],
    ['Classified Ads Submissions', data.classifiedAds],
    ['Business Listings', data.businessListings],
  ]
  const hasOff =
    offSections.some(([, rows]) => rows?.some(r => r.url?.trim())) ||
    data.web20?.some(r => r.url?.trim()) ||
    data.articles?.some(r => r.url?.trim())

  if (hasOff) {
    bigHeading('Off-Page SEO — Backlink Creations', [0, 0, 0])
    offSections.forEach(([label, rows]) => {
      if (!rows?.some(r => r.url?.trim())) return
      sectionBar(label)
      linkTable(rows)
    })

    const web = (data.web20 || []).filter(r => r?.url?.trim())
    if (web.length) {
      sectionBar('Web 2.0 Submissions')
      need(24)
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [['Website', 'Backlinks', 'Status']],
        body: web.map(r => [r.website || '', r.url, r.status || 'Live']),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', textColor: [40, 60, 130] },
        headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
        alternateRowStyles: { fillColor: GREY },
        columnStyles: {
          0: { cellWidth: 34, textColor: [30, 30, 30] },
          2: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [30, 30, 30] },
        },
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }

    if (data.articles?.some(r => r.url?.trim())) {
      sectionBar('Article Submission')
      linkTable(data.articles)
    }
  }

  // ================================================== WEBSITE KEYWORDS
  if (data.websiteKeywords?.some(k => k.keyword?.trim())) {
    sectionBar('Website – Keywords Ranking')
    keywordTable(data.websiteKeywords)
  }

  // ================================================== THANK YOU
  need(70)
  y += 8
  if (data.companyLogo) {
    const { w, h } = imgSize(doc, data.companyLogo, 70, 40)
    try { doc.addImage(data.companyLogo, (W - w) / 2, y, w, h) } catch { }
    y += h + 10
  }
  doc.setTextColor(...NAVY).setFont('helvetica', 'bold').setFontSize(20)
  doc.text('Thank You!', W / 2, y + 6, { align: 'center' })
  doc.setFontSize(16)
  doc.text(meta.agencyName, W / 2, y + 17, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // ---- page numbers ----
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(130)
    doc.text(`Page ${i} of ${total}`, W - M, H - 12, { align: 'right' })
  }

  return doc
}

/** Convenience: returns a base64 dataURL ready for /api/upload. */
export async function buildSeoReportDataUrl(meta: SeoReportMeta, data: SeoReportData): Promise<string> {
  const resolved = await preloadReportImages(data)
  const doc = generateSeoReportPdf(meta, resolved)
  return doc.output('datauristring')
}

export async function downloadSeoReportPdf(meta: SeoReportMeta, data: SeoReportData, filename?: string) {
  const resolved = await preloadReportImages(data)
  const doc = generateSeoReportPdf(meta, resolved)
  doc.save(filename || `${meta.businessName}-SEO-Report-${meta.reportMonth}.pdf`.replace(/\s+/g, '-'))
}

/** Preview: render and open the PDF in a new browser tab (no download). */
export async function openSeoReportPdf(meta: SeoReportMeta, data: SeoReportData) {
  const resolved = await preloadReportImages(data)
  const doc = generateSeoReportPdf(meta, resolved)
  const url = doc.output('bloburl') as unknown as string
  const win = window.open(url, '_blank')
  if (!win) throw new Error('Popup blocked — allow popups to preview the report')
  return url
}
