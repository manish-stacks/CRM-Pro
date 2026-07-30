'use client'
// src/components/AvatarCropper.tsx
// Lets the user pan/zoom their photo inside a square + circular guide before it's
// uploaded, so it always frames correctly on the ID card (idCard.ts crops the
// avatar into a circle, so the safe area to compose here is a 1:1 square).
import { useEffect, useRef, useState, useCallback } from 'react'
import { Modal } from '@/components/ui'
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react'

const VIEWPORT = 300   // on-screen crop box size (px)
const OUTPUT = 500     // exported square image size (px) — matches idCard.ts circularCrop default

interface Props {
  file: File | null
  onCancel: () => void
  onCropped: (dataUrl: string) => void
}

export default function AvatarCropper({ file, onCancel, onCropped }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean }>({
    startX: 0, startY: 0, origX: 0, origY: 0, dragging: false,
  })

  useEffect(() => {
    if (!file) { setImgUrl(null); return }
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    setZoom(1)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = natural.w && natural.h ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1
  const scale = baseScale * zoom
  const dispW = natural.w * scale
  const dispH = natural.h * scale

  const clamp = useCallback((x: number, y: number, dw = dispW, dh = dispH) => ({
    x: Math.min(0, Math.max(VIEWPORT - dw, x)),
    y: Math.min(0, Math.max(VIEWPORT - dh, y)),
  }), [dispW, dispH])

  const onImgLoad = () => {
    const img = imgRef.current
    if (!img) return
    const w = img.naturalWidth, h = img.naturalHeight
    setNatural({ w, h })
    const bs = Math.max(VIEWPORT / w, VIEWPORT / h)
    // Center the image in the viewport initially
    setOffset({ x: (VIEWPORT - w * bs) / 2, y: (VIEWPORT - h * bs) / 2 })
  }

  // Re-clamp whenever zoom changes so the image never leaves the viewport uncovered
  useEffect(() => {
    setOffset(o => clamp(o.x, o.y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, natural.w, natural.h])

  const startDrag = (clientX: number, clientY: number) => {
    dragState.current = { startX: clientX, startY: clientY, origX: offset.x, origY: offset.y, dragging: true }
  }
  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragState.current.dragging) return
    const dx = clientX - dragState.current.startX
    const dy = clientY - dragState.current.startY
    setOffset(clamp(dragState.current.origX + dx, dragState.current.origY + dy))
  }
  const endDrag = () => { dragState.current.dragging = false }

  const confirmCrop = () => {
    const img = imgRef.current
    if (!img || !natural.w) return
    // Map the visible viewport square back to source-image coordinates
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const sSize = VIEWPORT / scale

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT)
    onCropped(canvas.toDataURL('image/jpeg', 0.92))
  }

  if (!file) return null

  return (
    <Modal open={!!file} onClose={onCancel} title="Adjust your photo" className="max-w-md">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs text-gray-500 -mt-2 text-center">
          Drag to reposition, zoom to fit your face inside the circle — this is exactly how it'll appear on your ID card.
        </p>

        <div
          className="relative overflow-hidden rounded-lg bg-gray-900 select-none touch-none"
          style={{ width: VIEWPORT, height: VIEWPORT, cursor: 'grab' }}
          onMouseDown={e => startDrag(e.clientX, e.clientY)}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={endDrag}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: dispW || 'auto',
                height: dispH || 'auto',
                maxWidth: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Circular guide — darkened outside, matches the ID card's circular photo cutout */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`, borderRadius: '50%', margin: 'auto' }}
          />
          <div className="absolute inset-0 rounded-full border-2 border-white/80 pointer-events-none" />
        </div>

        <div className="flex items-center gap-3 w-full px-2">
          <ZoomOut size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <ZoomIn size={16} className="text-gray-400 flex-shrink-0" />
        </div>

        <div className="flex gap-2 w-full">
          <button onClick={onCancel} className="btn-secondary flex-1 flex items-center justify-center gap-1.5">
            <X size={14} /> Cancel
          </button>
          <button onClick={confirmCrop} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
            <Check size={14} /> Use Photo
          </button>
        </div>
      </div>
    </Modal>
  )
}
