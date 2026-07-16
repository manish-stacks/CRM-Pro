// src/lib/pdfRenderer.ts
import puppeteer, { Browser } from 'puppeteer'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export const runtime = 'nodejs'

const PAGE_W_MM = 210

/** Production pe puppeteer ka bundled Chromium aksar missing hota hai.
 *  ENV se ya system se resolve karo. */
function resolveExecutablePath(): string | undefined {
  const envPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    process.env.CHROMIUM_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c } catch {}
  }

  // puppeteer ka apna download (agar hai to)
  try {
    const p = puppeteer.executablePath()
    if (p && fs.existsSync(p)) return p
  } catch {}

  return undefined
}

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--single-process',
  '--font-render-hinting=none',
  '--disable-extensions',
  '--hide-scrollbars',
  '--mute-audio',
]

let browserPromise: Promise<Browser> | null = null

async function launchBrowser(): Promise<Browser> {
  const executablePath = resolveExecutablePath()
  if (!executablePath) {
    throw new Error(
      'Chromium not found. Server pe install karo (apt install -y chromium OR npx puppeteer browsers install chrome) ' +
      'aur PUPPETEER_EXECUTABLE_PATH env set karo.'
    )
  }
  return puppeteer.launch({
    headless: true,
    executablePath,
    args: LAUNCH_ARGS,
    protocolTimeout: 120_000,
  })
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser()
    browserPromise
      .then(b => b.on('disconnected', () => { browserPromise = null }))
      .catch(() => { browserPromise = null })
  }
  return browserPromise
}

type Letterhead = { dataUri: string; heightMm: number }
let letterheadCache: { header: Letterhead; footer: Letterhead } | null = null

async function loadTrimmed(filePath: string): Promise<Letterhead> {
  const raw = fs.readFileSync(filePath)
  const trimmed = await sharp(raw).trim().toBuffer({ resolveWithObject: true })
  const { width, height } = trimmed.info
  const heightMm = (height / width) * PAGE_W_MM
  return {
    dataUri: `data:image/jpeg;base64,${trimmed.data.toString('base64')}`,
    heightMm,
  }
}

async function getLetterheadImages() {
  if (!letterheadCache) {
    const headerPath = path.join(process.cwd(), 'public', 'letterhead', 'header.jpg')
    const footerPath = path.join(process.cwd(), 'public', 'letterhead', 'footer.jpg')
    if (!fs.existsSync(headerPath) || !fs.existsSync(footerPath)) {
      throw new Error(`Letterhead images missing: ${headerPath} / ${footerPath}`)
    }
    letterheadCache = {
      header: await loadTrimmed(headerPath),
      footer: await loadTrimmed(footerPath),
    }
  }
  return letterheadCache
}

const LETTER_BODY_STYLES = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 13.5px; line-height: 1.55; color: #1a1a1a; }
  .content { padding: 0 20mm; }
  .letter-title { text-align: center; font-size: 16px; font-weight: bold; text-decoration: underline; margin: 10px 0 22px; }
  p { margin: 0 0 12px; text-align: justify; }
  .no-justify { text-align: left; }
  .field { font-weight: bold; }
  ul { margin: 0 0 12px 22px; padding: 0; }
  li { margin-bottom: 4px; }
  table.kv { border-collapse: collapse; margin: 10px 0 16px; }
  table.kv td { padding: 4px 14px 4px 0; }
  table.kv td.k { font-weight: bold; width: 190px; }
  .sig-block { margin-top: 46px; }
`

const BUSINESS_BODY_STYLES = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; line-height: 1.5; color: #1e293b; }
  .content { padding: 4mm 16mm 0; }
  h1, h2, h3 { margin: 0; }
  table { border-collapse: collapse; }
  .accent-bar { height: 5px; background: linear-gradient(90deg, #1e3a8a, #dc2626); border-radius: 3px; margin-bottom: 16px; }
  .doc-title { text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; margin: 0 0 20px; color: #0f172a; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 20px; }
  .doc-header .company-name { font-size: 18px; font-weight: 800; color: #dc2626; letter-spacing: 0.2px; }
  .doc-meta { text-align: right; font-size: 12px; color: #334155; }
  .doc-meta .doc-number { font-weight: 800; font-size: 15px; color: #0f172a; margin-bottom: 3px; }
  .doc-meta div { margin-bottom: 2px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 10.5px; font-weight: 700; margin-top: 5px; letter-spacing: 0.3px; }
  .badge-paid, .badge-good { background: #dcfce7; color: #15803d; }
  .badge-pending, .badge-warn { background: #fef9c3; color: #a16207; }
  .badge-overdue, .badge-bad { background: #fee2e2; color: #b91c1c; }
  .badge-neutral { background: #dbeafe; color: #1d4ed8; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #94a3b8; margin-bottom: 7px; }
  .two-col { display: flex; gap: 24px; margin-bottom: 22px; }
  .info-box { flex: 1; background: #f8fafc; border-radius: 8px; padding: 12px 14px; }
  .items-table { width: 100%; font-size: 12px; margin-bottom: 6px; border-radius: 6px; overflow: hidden; }
  .items-table th { background: #1e293b; color: #f1f5f9; padding: 9px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 700; }
  .items-table td { padding: 9px 10px; border-bottom: 1px solid #eef1f5; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table tr:nth-child(even) td { background: #f8fafc; }
  .totals-wrap { display: flex; justify-content: flex-end; margin: 16px 0 22px; }
  .totals { width: 290px; font-size: 12.5px; background: #f8fafc; border-radius: 8px; padding: 4px 0; overflow: hidden; }
  .totals .row { display: flex; justify-content: space-between; padding: 6px 14px; }
  .totals .row.final { font-weight: 800; font-size: 15px; border-top: 2px solid #1e293b; color: #0f172a; padding-top: 10px; margin-top: 4px; }
  .totals .row.due { color: #dc2626; font-weight: 700; }
  .totals .row.paid { color: #16a34a; }
  .notes-box { margin-top: 20px; padding: 12px 15px; background: #f8fafc; border-left: 3px solid #1e3a8a; border-radius: 0 6px 6px 0; font-size: 12px; }
  .sig-area { display: flex; justify-content: flex-end; margin-top: 48px; }
  .sig-area .sig { text-align: center; }
  .sig-area .sig-line { border-top: 1px solid #94a3b8; padding-top: 5px; margin-top: 42px; font-size: 11px; color: #64748b; width: 190px; }
  .pay-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 12px; margin-bottom: 18px; background: #f8fafc; border-radius: 8px; padding: 14px 16px; }
  .pay-grid .r { display: flex; }
  .pay-grid .lbl { width: 105px; font-weight: 700; color: #334155; flex-shrink: 0; }
  .amt { text-align: right; }
  .pay-table { width: 100%; border-radius: 6px; overflow: hidden; }
  .pay-table td, .pay-table th { border: 1px solid #e2e8f0; padding: 8px 10px; }
  .pay-table th { background: #1e293b; color: #f1f5f9; text-align: left; font-weight: 700; }
  .pay-table .total-row td { font-weight: 700; background: #f1f5f9; }
  .pay-table .net-row td { font-weight: 800; background: #1e3a8a; color: #fff; font-size: 13px; border-color: #1e3a8a; }
`

interface RenderOptions {
  useLetterheadImages: boolean
}

async function pdfOnce(bodyHtml: string, title: string, bodyStyles: string, opts: RenderOptions): Promise<Buffer> {
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${bodyStyles}</style>
</head>
<body>
  <div class="content">${bodyHtml}</div>
</body>
</html>`

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    page.setDefaultNavigationTimeout(60_000)
    // networkidle0 par local pe hang hota hai jab koi external asset ho -> domcontentloaded + fonts wait
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {})

    if (opts.useLetterheadImages) {
      const { header, footer } = await getLetterheadImages()
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        timeout: 90_000,
        margin: {
          top: `${header.heightMm}mm`,
          bottom: `${footer.heightMm}mm`,
          left: '0mm',
          right: '0mm',
        },
        headerTemplate: `
          <div style="width:100%;height:100%;margin:0;padding:0;">
            <img src="${header.dataUri}" style="display:block;width:100%;margin:0;padding:0;" />
          </div>`,
        footerTemplate: `
          <div style="width:100%;height:100%;margin:0;padding:0;">
            <img src="${footer.dataUri}" style="display:block;width:100%;height:100%;margin:0;padding:0;" />
          </div>`,
      })
      return Buffer.from(pdf)
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      timeout: 90_000,
      margin: { top: '10mm', bottom: '14mm', left: '0mm', right: '0mm' },
      headerTemplate: `<div></div>`,
      footerTemplate: `<div style="width:100%;font-family:Arial,Helvetica,sans-serif;font-size:8.5px;color:#94a3b8;text-align:center;padding-top:2px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    })
    return Buffer.from(pdf)
  } finally {
    await page.close().catch(() => {})
  }
}

async function renderHtmlToPdf(bodyHtml: string, title: string, bodyStyles: string, opts: RenderOptions): Promise<Buffer> {
  try {
    return await pdfOnce(bodyHtml, title, bodyStyles, opts)
  } catch (err) {
    // stale/crashed browser — ek baar reset kar ke retry
    try { const b = await browserPromise; await b?.close() } catch {}
    browserPromise = null
    return await pdfOnce(bodyHtml, title, bodyStyles, opts)
  }
}

export async function renderLetterPdf(bodyHtml: string, title: string): Promise<Buffer> {
  return renderHtmlToPdf(bodyHtml, title, LETTER_BODY_STYLES, { useLetterheadImages: true })
}

export async function renderBusinessPdf(bodyHtml: string, title: string): Promise<Buffer> {
  return renderHtmlToPdf(bodyHtml, title, BUSINESS_BODY_STYLES, { useLetterheadImages: false })
}