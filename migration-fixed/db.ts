// migration/lib/db.ts
// Connection to the OLD (legacy PHP) MySQL database. This is separate from
// the Prisma `DATABASE_URL` which points at the NEW schema.
import mysql from 'mysql2/promise'

const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL

if (!OLD_DATABASE_URL) {
  throw new Error(
    'OLD_DATABASE_URL is not set. Add it to your .env — it should point at ' +
      'a MySQL database that has u119813757_hbs_crm.sql already imported.'
  )
}

export const oldDb = mysql.createPool(OLD_DATABASE_URL)

export async function queryOld<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await oldDb.query(sql, params)
  return rows as T[]
}

export async function closeOldDb() {
  await oldDb.end()
}
