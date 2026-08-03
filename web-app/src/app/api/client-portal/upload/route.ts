// src/app/api/client-portal/upload/route.ts
// Client-portal image upload (avatar). The generic /api/upload route only
// accepts staff sessions (getRequestSession explicitly rejects client
// tokens), so client-side uploads need their own endpoint using
// getClientSession instead.
import { NextRequest, NextResponse } from 'next/server'
import { getClientSession } from '@/lib/clientAuth'
import { uploadFile } from '@/lib/cloudinary'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB safety cap

export async function POST(req: NextRequest) {
  const session = await getClientSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { dataUrl } = await req.json()

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid dataUrl - must be a base64 data URL starting with data:' }, { status: 400 })
    }

    const b64 = dataUrl.split(',')[1] || ''
    const estimatedBytes = Math.floor(b64.length * 0.75)
    if (estimatedBytes > MAX_BYTES) {
      return NextResponse.json({ error: `File too large. Max ${(MAX_BYTES / 1024 / 1024).toFixed(1)}MB` }, { status: 400 })
    }

    const result = await uploadFile(dataUrl, 'client-images', {
      publicId: `client-images_${session.clientId}_${Date.now()}`,
    })

    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('Client upload error:', e)
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 })
  }
}
