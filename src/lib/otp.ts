// src/lib/otp.ts
// Helpers for the password-reset OTP flow.
import { hash, compare } from 'bcryptjs'

export const OTP_TTL_MS = 10 * 60 * 1000   // 10 minutes
export const OTP_MAX_ATTEMPTS = 5

/** 6-digit numeric OTP as a string (leading zeros preserved). */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function hashOtp(otp: string): Promise<string> {
  return hash(otp, 10)
}

export function compareOtp(otp: string, hashed: string): Promise<boolean> {
  return compare(otp, hashed)
}
