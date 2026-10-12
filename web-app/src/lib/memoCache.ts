// Tiny in-memory TTL cache for expensive aggregate queries (counts / groupBy on big tables).
// Per Node process; entries expire on their own, and invalidateCache() clears by key prefix.
const store = new Map<string, { exp: number; val: unknown }>()
const MAX_ENTRIES = 500

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return hit.val as T
  const val = await fn()
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string)
  store.set(key, { exp: Date.now() + ttlMs, val })
  return val
}

export function invalidateCache(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
}
