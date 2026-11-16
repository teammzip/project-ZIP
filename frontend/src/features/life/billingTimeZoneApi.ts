import { getCurrentMapPosition, readMapPoint } from '@/features/map/location'
import { validTimeZone, type BillingAddress } from './billingTimeZone'

const zoneCache = new Map<string, { zone: string; expires: number }>()
let geocodeQueue: Promise<unknown> = Promise.resolve()
let nextGeocodeAt = 0

function cached(key: string) {
  const value = zoneCache.get(key)
  if (value && value.expires > Date.now()) return value.zone
  zoneCache.delete(key)
}
function remember(key: string, zone: string) {
  if (zoneCache.size >= 100) zoneCache.delete(zoneCache.keys().next().value!)
  zoneCache.set(key, { zone, expires: Date.now() + 86400000 })
  return zone
}
async function json(url: URL, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) })
  if (!response.ok) throw new Error('시간대를 확인하지 못했어요.')
  return response.json()
}

/** 대한민국으로 식별되는 주소는 외부에 상세주소를 보내지 않고 처리한다. */
export function koreanAddressTimeZone(address: string) {
  return /^(?:대한민국|한국|서울(?:특별시|시)?|부산(?:광역시|시)?|대구(?:광역시|시)?|인천(?:광역시|시)?|광주(?:광역시|시)?|대전(?:광역시|시)?|울산(?:광역시|시)?|세종(?:특별자치시|시)?|경기(?:도)?|강원(?:특별자치도|도)?|충북|충남|충청북도|충청남도|전북(?:특별자치도)?|전남|전라북도|전라남도|경북|경남|경상북도|경상남도|제주(?:특별자치도|도)?)(?:\s|$)/.test(address.trim()) ? 'Asia/Seoul' : null
}

export async function coordinateTimeZone(point: { lat: number; lon: number }, signal: AbortSignal) {
  if (!readMapPoint(point)) throw new Error('좌표가 올바르지 않아요.')
  signal.throwIfAborted()
  const key = `point:${point.lat}:${point.lon}`, saved = cached(key)
  if (saved) return saved
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({ latitude: String(point.lat), longitude: String(point.lon), timezone: 'auto', current: 'temperature_2m', forecast_days: '1' }).toString()
  const result = await json(url, signal)
  if (!result || typeof result !== 'object' || !('timezone' in result) || !validTimeZone(result.timezone)) throw new Error('시간대 응답이 올바르지 않아요.')
  return remember(key, result.timezone)
}

export async function addressTimeZone(address: BillingAddress, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const korean = koreanAddressTimeZone(address.label)
  if (korean) return korean
  const key = `address:${address.label.trim()}`, saved = cached(key)
  if (saved) return saved
  if (address.point) return remember(key, await coordinateTimeZone(address.point, signal))
  const request = geocodeQueue.catch(() => undefined).then(async () => {
    const wait = nextGeocodeAt - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    signal.throwIfAborted()
    nextGeocodeAt = Date.now() + 1100
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.search = new URLSearchParams({ q: address.label, format: 'jsonv2', limit: '2' }).toString()
    const result = await json(url, signal)
    if (!Array.isArray(result) || !result.length) throw new Error('등록 주소를 확인하지 못했어요.')
    const points = result.slice(0, 2).map((item) => item && typeof item.lat === 'string' && item.lat.trim() && typeof item.lon === 'string' && item.lon.trim()
      ? readMapPoint({ lat: Number(item.lat), lon: Number(item.lon) }) : null)
    if (points.some((point) => !point)) throw new Error('주소 좌표를 확인하지 못했어요.')
    const zones = new Set(await Promise.all(points.map((point) => coordinateTimeZone(point!, signal))))
    if (zones.size !== 1) throw new Error('주소의 시간대가 모호해요.')
    return remember(key, [...zones][0])
  })
  geocodeQueue = request
  return request
}

export async function locationTimeZone(signal: AbortSignal) {
  signal.throwIfAborted()
  const point = await getCurrentMapPosition()
  signal.throwIfAborted()
  return coordinateTimeZone(point, signal)
}
