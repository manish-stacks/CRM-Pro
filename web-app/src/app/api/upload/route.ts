// src/app/api/upload/route.ts
// Generic authenticated file upload to Cloudinary (avatars, aadhar, id-proof, reports)
import { NextRequest } from 'next/server'
import { getRequestSession } from '@/lib/auth'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api'
import { uploadFile, UploadFolder } from '@/lib/cloudinary'

const ALLOWED_FOLDERS: UploadFolder[] = [
  'avatars', 'aadhar', 'id-proof', 'client-reports', 'client-images', 'chat-attachments', 'proposals', 'invoices', 'signatures', 'holiday-calendar', 'general',
]
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB safety cap

export async function POST(req: NextRequest) {
  const session = await getRequestSession(req)
  if (!session) return unauthorizedResponse()

  try {
    const { dataUrl, folder, resourceType } = await req.json()

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return errorResponse('Invalid dataUrl - must be a base64 data URL starting with data:')
    }
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return errorResponse(`Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`)
    }
    // Cloudinary blocks delivering PDF/ZIP via the "image" resource type by
    // default (security policy) — non-image files like the holiday calendar
    // PDF must be uploaded as "raw" or they 401 on delivery.
    const allowedResourceTypes = ['image', 'raw', 'video', 'auto']
    const resolvedResourceType = allowedResourceTypes.includes(resourceType) ? resourceType : undefined

    // Rough size check (base64 length * 0.75)
    const b64 = dataUrl.split(',')[1] || ''
    const estimatedBytes = Math.floor(b64.length * 0.75)
    if (estimatedBytes > MAX_BYTES) {
      return errorResponse(`File too large. Max ${(MAX_BYTES / 1024 / 1024).toFixed(1)}MB`)
    }

    const result = await uploadFile(dataUrl, folder as UploadFolder, {
      publicId: `${folder}_${session.userId}_${Date.now()}`,
      resourceType: resolvedResourceType,
    })

    return successResponse(result)
  } catch (e: any) {
    console.error('Upload error:', e)
    return errorResponse(e?.message || 'Upload failed', 500)
  }
}
