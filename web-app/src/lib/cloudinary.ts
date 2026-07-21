// src/lib/cloudinary.ts
// Cloudinary upload helper - used for avatars, aadhar, client reports
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

const FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER || 'hbs-crm'

export interface UploadResult {
  url: string
  publicId: string
  format: string
  bytes: number
  resourceType: string
}

export type UploadFolder =
  | 'avatars'
  | 'aadhar'
  | 'id-proof'
  | 'client-reports'
  | 'client-images'
  | 'chat-attachments'
  | 'proposals'
  | 'invoices'
  | 'general'

/**
 * Upload a base64 data URL or remote URL to Cloudinary
 * @param dataUrl - "data:image/png;base64,..." OR https://... URL
 * @param folder  - subfolder within HBS folder
 * @param opts    - override options
 */
export async function uploadFile(
  dataUrl: string,
  folder: UploadFolder = 'general',
  opts: { publicId?: string; resourceType?: 'image' | 'raw' | 'auto' | 'video' } = {}
): Promise<UploadResult> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your-cloud-name') {
    throw new Error('Cloudinary not configured. Set CLOUDINARY_* env vars.')
  }

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: `${FOLDER}/${folder}`,
    public_id: opts.publicId,
    resource_type: opts.resourceType || 'auto',
    overwrite: true,
  })

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    bytes: result.bytes,
    resourceType: result.resource_type,
  }
}

/** Delete a file by publicId */
export async function deleteFile(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    return result.result === 'ok'
  } catch (e) {
    console.error('Cloudinary delete failed:', e)
    return false
  }
}

/** Extract publicId from a Cloudinary URL for later deletion */
export function publicIdFromUrl(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i)
  return match ? match[1] : null
}
