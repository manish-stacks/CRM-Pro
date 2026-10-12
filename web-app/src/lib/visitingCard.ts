// Shared helpers for the marketing visiting card (link, vCard, PNG soft copy).
export interface CardData {
  employeeId: string; name: string; avatar?: string | null; position?: string | null
  phone?: string | null; email?: string | null
  company: { name: string; phone?: string; email?: string; address?: string; website?: string; logo?: string; profileUrl?: string }
}

export const cardLink = (employeeId: string) => `${window.location.origin}/card/${employeeId}`

export function whatsappShareUrl(text: string) { return `https://wa.me/?text=${encodeURIComponent(text)}` }

export function buildVCard(d: CardData): string {
  const esc = (v?: string | null) => (v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${esc(d.name)}`, `ORG:${esc(d.company.name)}`, `TITLE:${esc(d.position)}`,
    d.phone ? `TEL;TYPE=CELL:${d.phone}` : '',
    d.email ? `EMAIL:${d.email}` : '',
    d.company.website ? `URL:${d.company.website}` : '',
    d.company.address ? `ADR;TYPE=WORK:;;${esc(d.company.address)};;;;` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n')
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const downloadVCard = (d: CardData) => downloadBlob(buildVCard(d), `${d.name.replace(/\s+/g, '_')}.vcf`, 'text/vcard')

async function loadLogo(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return null
  const load = (src: string) => new Promise<HTMLImageElement | null>(res => {
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src
  })
  if (url.startsWith('/') || url.startsWith(window.location.origin)) return load(url)
  // Remote logo: go through the proxy so the canvas is not tainted (download would fail otherwise)
  try {
    const r = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`).then(x => x.json())
    return r?.data?.dataUrl ? load(r.data.dataUrl) : null
  } catch { return null }
}

// Colours taken from the HBS logo: charcoal #303030 + red #E53030.
const LOGO_RED = '#E53030', LOGO_CHARCOAL = '#303030', LOGO_BLACK = '#111111'

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): number {
  let line = '', yy = y
  for (const word of text.replace(/\s*\n\s*/g, ', ').split(/\s+/)) {
    const t = line ? `${line} ${word}` : word
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = word; yy += lh } else line = t
  }
  if (line) { g.fillText(line, x, yy); yy += lh }
  return yy
}

// Draws a 1050x600 card in the logo colours (logo on white, charcoal body, red accents,
// full address) and downloads it as PNG.
export async function downloadCardPng(d: CardData) {
  const W = 1050, H = 600
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d'); if (!g) return
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
  // Header: logo on white
  const logo = await loadLogo(d.company.logo)
  g.textBaseline = 'alphabetic'
  let hx = 50
  if (logo) {
    const h = 90, w = Math.min(260, (logo.width / logo.height) * h)
    g.drawImage(logo, 50, 28, w, h); hx = 50 + w + 24
  }
  g.fillStyle = '#111827'; g.font = 'bold 30px Arial'; g.fillText(d.company.name, hx, 82)
  // Brand body
  const grad = g.createLinearGradient(0, 140, W, H)
  grad.addColorStop(0, LOGO_CHARCOAL); grad.addColorStop(1, LOGO_BLACK)
  g.fillStyle = grad; g.fillRect(0, 140, W, H - 140)
  g.fillStyle = LOGO_RED; g.fillRect(0, 134, W, 8); g.fillRect(50, 150, 70, 5)
  g.fillStyle = '#fff'; g.font = 'bold 54px Arial'; g.fillText(d.name, 50, 225)
  g.fillStyle = '#FF6B6B'; g.font = '28px Arial'; g.fillText(d.position || 'Marketing Executive', 50, 268)
  g.fillStyle = '#fff'; g.font = '26px Arial'
  let y = 330
  const rows = [d.phone && `Phone: ${d.phone}`, d.email && `Email: ${d.email}`, d.company.website && `Web: ${d.company.website.replace(/^https?:\/\//, '')}`]
  rows.filter(Boolean).forEach(t => { g.fillText(String(t), 50, y); y += 42 })
  if (d.company.address) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '23px Arial'; wrap(g, `Address: ${d.company.address}`, 50, y + 6, W - 100, 32) }
  c.toBlob(b => b && downloadBlob(b, `${d.name.replace(/\s+/g, '_')}_visiting_card.png`, 'image/png'), 'image/png')
}
