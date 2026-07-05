// src/app/api/upload/route.ts
// Generic authenticated file upload to Cloudinary (avatars, aadhar, id-proof, reports)
import { NextRequest } from 'next/server'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { uploadFile, UploadFolder } from '@/lib/cloudinary'

const ALLOWED_FOLDERS: UploadFolder[] = [
  'avatars', 'aadhar', 'id-proof', 'client-reports', 'client-images', 'chat-attachments', 'proposals', 'invoices', 'general',
]
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB safety cap

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  try {
    const { dataUrl, folder } = await req.json()

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return errorResponse('Invalid dataUrl - must be a base64 data URL starting with data:')
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return errorResponse(`Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`)
    }

    // Rough size check (base64 length * 0.75)
    const b64 = dataUrl.split(',')[1] || ''
    const estimatedBytes = Math.floor(b64.length * 0.75)
    if (estimatedBytes > MAX_BYTES) {
      return errorResponse(`File too large. Max ${(MAX_BYTES / 1024 / 1024).toFixed(1)}MB`)
    }

    const result = await uploadFile(dataUrl, folder as UploadFolder, {
      publicId: `${folder}_${session.userId}_${Date.now()}`,
    })

    return successResponse(result)
  } catch (e: any) {
    console.error('Upload error:', e)
    return errorResponse(e?.message || 'Upload failed', 500)
  }
}
