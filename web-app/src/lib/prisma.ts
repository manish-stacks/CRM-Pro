// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

// Retain PrismaClient across hot-reloads and requests in both production and development
// to avoid connection exhaustion and repeated remote TLS handshakes.
globalForPrisma.prisma = prisma
