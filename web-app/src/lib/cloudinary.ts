// src/lib/cloudinary.ts
// File storage helper — Cloudflare R2 (S3-compatible). Filename kept as
// "cloudinary.ts" so no other file in the app needs to change; same
// exported functions/signatures as before (uploadFile, deleteFile,
// publicIdFromUrl, UploadResult, UploadFolder).
//
// Needs in .env:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_BUCKET_NAME, R2_PUBLIC_URL (public bucket domain / custom domain, no trailing slash)
// Needs package: npm install @aws-sdk/client-s3
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { BRAND } from './branding'

const FOLDER = process.env.R2_UPLOAD_FOLDER || BRAND.short.toLowerCase() + '-crm'
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
const BUCKET = process.env.R2_BUCKET_NAME || ''

function client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })
}

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
  | 'signatures'
  | 'holiday-calendar'
  | 'screenshots'
  | 'general'
  | 'announcements'

// "data:image/png;base64,AAAA..." OR a remote https URL -> { buffer, mime, ext }
async function toBuffer(dataUrl: string): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('Invalid data URL')
    const mime = match[1]
    const buffer = Buffer.from(match[2], 'base64')
    return { buffer, mime, ext: mime.split('/')[1]?.split('+')[0] || 'bin' }
  }
  // remote URL — fetch it first
  const res = await fetch(dataUrl)
  if (!res.ok) throw new Error(`Failed to fetch source file: ${res.status}`)
  const mime = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, mime, ext: mime.split('/')[1]?.split('+')[0] || 'bin' }
}

/**
 * Upload a base64 data URL or remote URL to Cloudflare R2
 * @param dataUrl - "data:image/png;base64,..." OR https://... URL
 * @param folder  - subfolder within the company's R2 folder
 * @param opts    - override options
 */
export async function uploadFile(
  dataUrl: string,
  folder: UploadFolder = 'general',
  opts: { publicId?: string; resourceType?: 'image' | 'raw' | 'auto' | 'video' } = {}
): Promise<UploadResult> {
  if (!process.env.R2_ACCOUNT_ID || !BUCKET || !PUBLIC_URL) {
    throw new Error('Cloudflare R2 not configured. Set R2_* env vars.')
  }

  const { buffer, mime, ext } = await toBuffer(dataUrl)
  const key = `${FOLDER}/${folder}/${opts.publicId ? opts.publicId.replace(/\.[a-z0-9]+$/i, '') : randomUUID()}.${ext}`

  await client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mime,
  }))

  return {
    url: `${PUBLIC_URL}/${key}`,
    publicId: key,
    format: ext,
    bytes: buffer.length,
    resourceType: mime.startsWith('image/') ? 'image' : 'raw',
  }
}

/** Delete a file by publicId (R2 object key) */
export async function deleteFile(publicId: string, _resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<boolean> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: publicId }))
    return true
  } catch (e) {
    console.error('R2 delete failed:', e)
    return false
  }
}

/** Extract publicId (R2 object key) from a stored file URL for later deletion */
export function publicIdFromUrl(url: string): string | null {
  if (PUBLIC_URL && url.startsWith(PUBLIC_URL + '/')) return url.slice(PUBLIC_URL.length + 1)
  // fallback: legacy Cloudinary-style URL, best-effort (old files — see migration script)
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i)
  return match ? match[1] : null
}
