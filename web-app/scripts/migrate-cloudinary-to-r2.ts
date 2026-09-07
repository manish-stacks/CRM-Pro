// scripts/migrate-cloudinary-to-r2.ts
// One-time: download every old Cloudinary file referenced in the DB and
// re-upload it to Cloudflare R2, then rewrite the DB field with the new URL.
// Run once, after R2_* env vars are set and `npm install @aws-sdk/client-s3`.
//   npx tsx scripts/migrate-cloudinary-to-r2.ts
import { PrismaClient } from '@prisma/client'
import { uploadFile } from '../src/lib/cloudinary' // already points at R2 after the code migration

const prisma = new PrismaClient()
const isCloudinary = (u?: string | null) => !!u && u.includes('res.cloudinary.com')

// [model, field, folder] — add more rows here if you find other Cloudinary fields
const TARGETS: { model: keyof PrismaClient; field: string; folder: any }[] = [
  { model: 'user', field: 'avatar', folder: 'avatars' },
  { model: 'employee', field: 'idProofUrl', folder: 'id-proof' },
  { model: 'employee', field: 'aadharFrontUrl', folder: 'aadhar' },
  { model: 'employee', field: 'aadharBackUrl', folder: 'aadhar' },
  { model: 'screenshotRequest', field: 'imageUrl', folder: 'screenshots' },
  { model: 'client', field: 'image', folder: 'client-images' },
  { model: 'client', field: 'gmbScreenshot', folder: 'client-images' },
  { model: 'clientReport', field: 'fileUrl', folder: 'client-reports' },
  { model: 'seoReport', field: 'pdfUrl', folder: 'client-reports' },
]

async function migrateField(model: keyof PrismaClient, field: string, folder: any) {
  const table = (prisma as any)[model]
  const rows = await table.findMany({ where: { [field]: { contains: 'res.cloudinary.com' } } })
  console.log(`${model}.${field}: ${rows.length} file(s) to migrate`)
  for (const row of rows) {
    const oldUrl = row[field]
    if (!isCloudinary(oldUrl)) continue
    try {
      const result = await uploadFile(oldUrl, folder, { publicId: row.id })
      await table.update({ where: { id: row.id }, data: { [field]: result.url } })
      console.log(`  OK  ${model}#${row.id}: ${oldUrl} -> ${result.url}`)
    } catch (e) {
      console.error(`  FAIL ${model}#${row.id}:`, (e as Error).message)
    }
  }
}

async function main() {
  for (const t of TARGETS) await migrateField(t.model, t.field, t.folder)
  console.log('Done.')
}

main().finally(() => prisma.$disconnect())
