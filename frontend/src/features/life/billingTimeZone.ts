export type TimeZoneSource = 'address' | 'location' | 'device'
export type BillingTimeZone = { timeZone: string; source: TimeZoneSource }
export type BillingAddress = { label: string; point?: { lat: number; lon: number } }

export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}

/** 실제 집 주소 → 본인 설문 주소 → 가입 주소. 다른 회원의 주소·좌표를 사용하지 않는다. */
export function registeredBillingAddress(
  user: { id: string; address: string } | null,
  homeAddress: string,
  survey: { userId?: string; address: string; addressPoint?: { lat: number; lon: number } } | null,
): BillingAddress {
  if (!user) return { label: '' }
  const ownSurvey = survey?.userId === user.id ? survey : null
  const label = homeAddress.trim() || ownSurvey?.address.trim() || user.address.trim()
  return { label, ...(ownSurvey && label === ownSurvey.address.trim() && ownSurvey.addressPoint ? { point: ownSurvey.addressPoint } : {}) }
}

/** 주소 성공 시 위치를 요청하지 않는다. 실패·권한 거부 시 다음 우선순위로 넘어간다. */
export async function resolveBillingTimeZone(input: {
  address: BillingAddress; deviceZone: string; signal: AbortSignal
  addressZone: (address: BillingAddress, signal: AbortSignal) => Promise<string>
  locationZone: (signal: AbortSignal) => Promise<string>
}): Promise<BillingTimeZone> {
  const { signal } = input
  signal.throwIfAborted()
  if (input.address.label) {
    try {
      const timeZone = await input.addressZone(input.address, signal)
      signal.throwIfAborted()
      if (validTimeZone(timeZone)) return { timeZone, source: 'address' }
    } catch { signal.throwIfAborted() }
  }
  try {
    const timeZone = await input.locationZone(signal)
    signal.throwIfAborted()
    if (validTimeZone(timeZone)) return { timeZone, source: 'location' }
  } catch { signal.throwIfAborted() }
  return { timeZone: validTimeZone(input.deviceZone) ? input.deviceZone : 'UTC', source: 'device' }
}
