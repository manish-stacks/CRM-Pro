// src/lib/idCard.ts
// Overlays employee photo/name/ID/phone/e-mail/QR on top of the HBS ID card
// template image (public/idcard/template.jpg) and previews it (like invoice PDFs)
// instead of force-downloading.
import jsPDF from 'jspdf'

interface IdCardEmployee {
  employeeId: string
  name: string
  department?: string | null
  position?: string | null
  bloodGroup?: string | null
  phone?: string | null
  email?: string | null
  joiningDate?: string | null
  avatarUrl?: string | null
  avatarInitials?: string
}
interface Company {
  name?: string
  phone?: string
  email?: string
}

const TEMPLATE_URL = '/idcard/template.jpg'
const DUMMY_AVATAR_URL = '/idcard/avatar-placeholder.png'
const QR_LOGO_URL = '/idcard/hbs-mark.png'

// Template is 1845 x 3137 px. Card is rendered at the same aspect ratio in mm,
// enlarged a bit from real CR80 size so text/photo stay crisp and legible.
const TPL_W = 1845, TPL_H = 3137
const CARD_W = 65
const K = CARD_W / TPL_W          // px -> mm scale factor
const CARD_H = TPL_H * K

// Positions measured directly on the template image (px), then scaled by K.
const PHOTO_CX = 922.5 * K, PHOTO_CY = 900.5 * K, PHOTO_R = 495.5 * K
const NAME_X1 = 110 * K, NAME_Y1 = 1749 * K, NAME_X2 = 1732 * K, NAME_Y2 = 1925 * K
const ROW_VALUE_X = 690 * K
// Baselines matched to the bottom of each printed label (no descenders in any of the 3 labels)
const ROW_ID_Y = 2105 * K
const ROW_PHONE_Y = 2256 * K
const ROW_EMAIL_Y = 2408 * K
// QR placeholder box measured precisely on the template: x 1253-1670, y 2621-3039 (square, ~417px)
const QR_BOX_X1 = 1253 * K, QR_BOX_Y1 = 2621 * K, QR_BOX_SIZE = (1670 - 1253) * K
const QR_PAD = 1 // mm inset so the QR doesn't touch the placeholder edges

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Crops a data URL image into a circle (transparent corners) using a canvas — far more
 *  reliable across browsers/PDF viewers than jsPDF's own path-clipping. */
function circularCrop(dataUrl: string, sizePx = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = sizePx
      canvas.height = sizePx
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.save()
      ctx.beginPath()
      ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      const scale = Math.max(sizePx / img.width, sizePx / img.height)
      const w = img.width * scale, h = img.height * scale
      ctx.drawImage(img, (sizePx - w) / 2, (sizePx - h) / 2, w, h)
      ctx.restore()
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}

/** Draws the company mark in the center of a QR code on a white padded square
 *  so it stays scannable (needs the QR to be generated with high error
 *  correction — see the `ecc=H` param on the qrserver URL below). */
function addLogoToQr(qrDataUrl: string, logoDataUrl: string, sizePx = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const qrImg = new Image()
    qrImg.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = sizePx
      canvas.height = sizePx
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no 2d context'))
      ctx.drawImage(qrImg, 0, 0, sizePx, sizePx)

      const logoImg = new Image()
      logoImg.onload = () => {
        const boxSize = sizePx * 0.26
        const boxX = (sizePx - boxSize) / 2, boxY = (sizePx - boxSize) / 2
        const radius = boxSize * 0.18
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.moveTo(boxX + radius, boxY)
        ctx.arcTo(boxX + boxSize, boxY, boxX + boxSize, boxY + boxSize, radius)
        ctx.arcTo(boxX + boxSize, boxY + boxSize, boxX, boxY + boxSize, radius)
        ctx.arcTo(boxX, boxY + boxSize, boxX, boxY, radius)
        ctx.arcTo(boxX, boxY, boxX + boxSize, boxY, radius)
        ctx.closePath()
        ctx.fill()

        const pad = boxSize * 0.12
        const availW = boxSize - pad * 2, availH = boxSize - pad * 2
        const scale = Math.min(availW / logoImg.width, availH / logoImg.height)
        const lw = logoImg.width * scale, lh = logoImg.height * scale
        ctx.drawImage(logoImg, boxX + (boxSize - lw) / 2, boxY + (boxSize - lh) / 2, lw, lh)
        resolve(canvas.toDataURL('image/png'))
      }
      logoImg.onerror = () => resolve(canvas.toDataURL('image/png')) // fall back to plain QR
      logoImg.src = logoDataUrl
    }
    qrImg.onerror = () => reject(new Error('qr image load failed'))
    qrImg.src = qrDataUrl
  })
}

/** Returns a PDF doc with the finished card (does not save/open it). */
export async function buildIdCardDoc(emp: IdCardEmployee, company: Company = {}): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [CARD_W, CARD_H] })

  // ---- Background template ----
  const templateData = await loadImageAsDataUrl(TEMPLATE_URL)
  if (templateData) doc.addImage(templateData, 'JPEG', 0, 0, CARD_W, CARD_H)

  // ---- Employee photo, circularly cropped to fit exactly inside the template's circle ----
  const rawAvatar = (emp.avatarUrl && await loadImageAsDataUrl(emp.avatarUrl)) || await loadImageAsDataUrl(DUMMY_AVATAR_URL)
  if (rawAvatar) {
    try {
      const circular = await circularCrop(rawAvatar)
      doc.addImage(circular, 'PNG', PHOTO_CX - PHOTO_R, PHOTO_CY - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2)
    } catch {
      // fall back silently — template still shows fine without a photo
    }
  }

  // ---- Name: in the white gap between the photo and the orange bar, dark/black ----
  const barMidX = (NAME_X1 + NAME_X2) / 2
  const barMaxWidth = NAME_X2 - NAME_X1 - 6
  const photoBottom = PHOTO_CY + PHOTO_R
  const nameY = photoBottom + (NAME_Y1 - photoBottom) / 2 + 2 // + baseline offset to visually center
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(emp.name || '—', barMidX, nameY, { align: 'center', maxWidth: barMaxWidth })

  // ---- Designation, vertically centered inside the orange bar ----
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(emp.position || 'Employee', barMidX, (NAME_Y1 + NAME_Y2) / 2 + 1.3, { align: 'center', maxWidth: barMaxWidth })

  // ---- ID Number / Phone / E-mail values ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(50, 50, 50)
  doc.text(emp.employeeId || '—', ROW_VALUE_X, ROW_ID_Y, { maxWidth: CARD_W - ROW_VALUE_X - 3 })
  doc.text(emp.phone || '—', ROW_VALUE_X, ROW_PHONE_Y, { maxWidth: CARD_W - ROW_VALUE_X - 3 })
  doc.text(emp.email || '—', ROW_VALUE_X, ROW_EMAIL_Y, { maxWidth: CARD_W - ROW_VALUE_X - 3 })

  // ---- QR code, squared and centered inside the placeholder box ----
  const qrPayload = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || ''}/id-verify/${emp.employeeId}`
  )
  const qrData = await loadImageAsDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&ecc=H&data=${qrPayload}`)
  if (qrData) {
    const qrSize = QR_BOX_SIZE - QR_PAD * 2
    let finalQr = qrData
    const logoData = await loadImageAsDataUrl(QR_LOGO_URL)
    if (logoData) {
      try { finalQr = await addLogoToQr(qrData, logoData) } catch { /* plain QR is fine */ }
    }
    doc.addImage(finalQr, 'PNG', QR_BOX_X1 + QR_PAD, QR_BOX_Y1 + QR_PAD, qrSize, qrSize)
  }

  return doc
}

/** Opens the generated card in a new tab for preview (matches invoice PDF preview) — no forced download. */
export async function generateIdCard(emp: IdCardEmployee, company: Company = {}) {
  const doc = await buildIdCardDoc(emp, company)
  window.open(doc.output('bloburl'), '_blank')
}