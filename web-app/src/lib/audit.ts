// src/lib/audit.ts
// Activity log helper — for admin audit trail
import { prisma } from './prisma'
import { NextRequest } from 'next/server'
import { deviceFromRequest } from './device'

export interface AuditLogParams {
  userId?: string | null
  action: string        // CREATE, UPDATE, DELETE, ASSIGN, LOGIN, LOGOUT, EXPORT, IMPORT, PAY, RENEW
  entityType: string    // Lead, Client, Employee, Proposal, Invoice, Payment etc
  entityId?: string | null
  changes?: any         // Any JSON-serializable object
  ipAddress?: string | null
  metadata?: any
}

export async function logActivity(params: AuditLogParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        ipAddress: params.ipAddress || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    })
  } catch (e) {
    // Never crash the main flow on audit failure
    console.error('Audit log failed:', e)
  }
}

/**
 * Convenient wrapper that auto-extracts IP from a NextRequest
 */
export async function logFromRequest(
  req: NextRequest,
  params: Omit<AuditLogParams, 'ipAddress'>
): Promise<void> {
  const device = deviceFromRequest(req)
  return logActivity({ ...params, ipAddress: device.ip })
}

/**
 * Log a login attempt (success or failure) with device info
 */
export async function logLogin(params: {
  userId: string | null
  status: 'SUCCESS' | 'FAILED'
  req: NextRequest
  latitude?: number
  longitude?: number
  location?: string
}): Promise<string | null> {
  const device = deviceFromRequest(params.req)

  try {
    if (params.status === 'SUCCESS' && params.userId) {
      const activity = await prisma.loginActivity.create({
        data: {
          userId: params.userId,
          status: 'SUCCESS',
          ipAddress: device.ip,
          userAgent: device.userAgent,
          browser: device.browser,
          os: device.os,
          device: device.device,
          latitude: params.latitude,
          longitude: params.longitude,
          location: params.location,
        },
      })
      // Also update User.lastLoginAt
      await prisma.user.update({ where: { id: params.userId }, data: { lastLoginAt: new Date() } })
      return activity.id
    } else if (params.userId) {
      const activity = await prisma.loginActivity.create({
        data: {
          userId: params.userId,
          status: 'FAILED',
          ipAddress: device.ip,
          userAgent: device.userAgent,
          browser: device.browser,
          os: device.os,
          device: device.device,
        },
      })
      return activity.id
    }
  } catch (e) {
    console.error('Login log failed:', e)
  }
  return null
}

/** Mark a login activity as logged out */
export async function logLogout(loginActivityId: string): Promise<void> {
  try {
    await prisma.loginActivity.update({
      where: { id: loginActivityId },
      data: { logoutAt: new Date() },
    })
  } catch (e) {
    console.error('Logout log failed:', e)
  }
}
