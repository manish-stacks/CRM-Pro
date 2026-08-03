// src/lib/api.ts
// Response helpers.
// FIX: The old ambiguity bug (treating `total` in [200..599] as HTTP status)
// is eliminated by making the second parameter of successResponse ALWAYS mean total.
// For custom status codes, use `successStatusResponse(data, status)`.
import { NextResponse } from 'next/server'

/** Success response — optional pagination total */
export function successResponse(data: unknown, total?: number) {
  if (total !== undefined) {
    return NextResponse.json({ data, total }, { status: 200 })
  }
  return NextResponse.json({ data }, { status: 200 })
}

/** Success response with a custom HTTP status code (201 etc) */
export function successStatusResponse(data: unknown, status: number) {
  return NextResponse.json({ data }, { status })
}

/** Standard error response */
export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function notFoundResponse(resource = 'Resource') {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}
