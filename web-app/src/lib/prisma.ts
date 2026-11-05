// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  if (!url.includes('connection_limit')) {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}connection_limit=7&pool_timeout=20`
  }
  return url
}

const dbUrl = getDatabaseUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: ['error', 'warn'],
  })

// ALWAYS retain PrismaClient on globalThis to reuse connection pool across requests in both dev and production
globalForPrisma.prisma = prisma
