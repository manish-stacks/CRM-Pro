// Looks up city & state for an Indian PIN code using the free India Post API.
// Returns null if the pincode is invalid / not found / request fails.
export async function lookupPincode(pincode: string): Promise<{ city: string; state: string } | null> {
  const clean = (pincode || '').trim()
  if (!/^\d{6}$/.test(clean)) return null

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`)
    if (!res.ok) return null
    const data = await res.json()
    const result = Array.isArray(data) ? data[0] : null
    if (!result || result.Status !== 'Success' || !result.PostOffice?.length) return null

    const po = result.PostOffice[0]
    return {
      city: po.District || po.Block || po.Name || '',
      state: po.State || '',
    }
  } catch {
    return null
  }
}
