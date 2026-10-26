import { z } from 'zod'
import { normRegion, sameRegion } from '@/features/life/locateRegion'
import { readJSON, writeJSON } from '@/lib/storage'

const placeSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), name: z.string() })
export type WeatherPlace = z.infer<typeof placeSchema>
const cacheSchema = z.object({ place: placeSchema, expires: z.number() })
const numberOrNull = z.number().finite().nullable()
const forecastSchema = z.object({
  current: z.object({ time: z.string(), temperature_2m: numberOrNull, weather_code: numberOrNull, is_day: numberOrNull }),
  daily: z.object({ time: z.array(z.string()), temperature_2m_min: z.array(numberOrNull), temperature_2m_max: z.array(numberOrNull), precipitation_probability_max: z.array(numberOrNull) }),
  hourly: z.object({ time: z.array(z.string()), temperature_2m: z.array(numberOrNull), precipitation_probability: z.array(numberOrNull), weather_code: z.array(numberOrNull), is_day: z.array(numberOrNull) }),
})
export type Forecast = z.infer<typeof forecastSchema>

export const koreaTime = (now = Date.now()) => new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 16)
export const temperatureText = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value)}°`
export const probabilityText = (value: number | null | undefined) => value == null ? '정보 없음' : `${Math.round(value)}%`

export function weatherDescription(code: number | null | undefined, isDay = true) {
  if (code === 0) return { icon: isDay ? '☀️' : '🌙', text: '맑음' }
  if (code === 1) return { icon: isDay ? '🌤️' : '🌙', text: '대체로 맑음' }
  if (code === 2) return { icon: '⛅', text: '구름 조금' }
  if (code === 3) return { icon: '☁️', text: '흐림' }
  if (code === 45 || code === 48) return { icon: '🌫️', text: '안개' }
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return { icon: '🌧️', text: '이슬비' }
  if ([61, 63, 65, 66, 67].includes(code ?? -1)) return { icon: '🌧️', text: '비' }
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return { icon: '❄️', text: '눈' }
  if ([80, 81, 82].includes(code ?? -1)) return { icon: '🌦️', text: '소나기' }
  if ([95, 96, 99].includes(code ?? -1)) return { icon: '⛈️', text: '뇌우' }
  return { icon: '🌡️', text: '날씨 정보 없음' }
}

export function upcomingHours(data: Forecast, now = Date.now()) {
  const hour = `${koreaTime(now).slice(0, 13)}:00`
  return data.hourly.time.flatMap((time, i) => time >= hour ? [{
    time, temperature: data.hourly.temperature_2m[i], probability: data.hourly.precipitation_probability[i],
    code: data.hourly.weather_code[i], isDay: data.hourly.is_day[i] !== 0,
  }] : []).slice(0, 12)
}

async function fetchJSON(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) })
  if (!response.ok) throw new Error('날씨 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  return response.json() as Promise<unknown>
}

// Nominatim은 자동완성 없이 저장한 동네만 검색. 결과를 캐시하고 요청을 직렬화한다.
let geoQueue: Promise<unknown> = Promise.resolve()
let nextGeoAt = 0
export async function resolveWeatherPlace(region: string, signal: AbortSignal): Promise<WeatherPlace> {
  const normalized = normRegion(region)
  if (!normalized) throw new Error('날씨를 볼 동네를 입력해 주세요.')
  const key = `zip-weather-place:${normalized}`
  const cached = cacheSchema.safeParse(readJSON(key))
  if (cached.success && cached.data.expires > Date.now()) return cached.data.place
  const request = geoQueue.catch(() => undefined).then(async () => {
    const delay = nextGeoAt - Date.now()
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    signal.throwIfAborted()
    nextGeoAt = Date.now() + 1100
    const url = new URL(import.meta.env.VITE_WEATHER_GEOCODING_URL || 'https://nominatim.openstreetmap.org/search', window.location.origin)
    url.search = new URLSearchParams({ q: normalized, format: 'jsonv2', countrycodes: 'kr', limit: '5', layer: 'address', 'accept-language': 'ko' }).toString()
    const result = z.array(z.object({ lat: z.string(), lon: z.string(), display_name: z.string() })).parse(await fetchJSON(url.toString(), signal))
    const matches = result.filter((r) => sameRegion(normalized, r.display_name.replaceAll(',', ' ')))
    const unique = [...new Map(matches.map((r) => [r.display_name, r])).values()]
    if (unique.length !== 1) throw new Error('동네를 찾기 어려워요. “서울 마포구”처럼 시·도와 시·군·구를 함께 입력해 주세요.')
    const place = placeSchema.parse({ latitude: Number(unique[0].lat), longitude: Number(unique[0].lon), name: normalized })
    writeJSON(key, { place, expires: Date.now() + 90 * 24 * 60 * 60 * 1000 })
    return place
  })
  geoQueue = request
  return request
}

export async function fetchForecast(place: WeatherPlace, signal: AbortSignal): Promise<Forecast> {
  const url = new URL(import.meta.env.VITE_WEATHER_FORECAST_URL || 'https://api.open-meteo.com/v1/forecast', window.location.origin)
  url.search = new URLSearchParams({
    latitude: String(place.latitude), longitude: String(place.longitude), timezone: 'Asia/Seoul', forecast_days: '2',
    current: 'temperature_2m,weather_code,is_day',
    hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  }).toString()
  const parsed = forecastSchema.safeParse(await fetchJSON(url.toString(), signal))
  if (!parsed.success || parsed.data.current.temperature_2m == null || !parsed.data.daily.time.includes(koreaTime().slice(0, 10))) {
    throw new Error('오늘 날씨 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  return parsed.data
}
