import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('import.meta.env', '({})'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const regionExports = {}
vm.runInNewContext(compile('../src/features/life/locateRegion.ts'), { exports: regionExports })
const code = compile('../src/features/weather/api.ts')
function setup(fetcher = async () => { throw new Error('Unexpected request') }) {
  const cache = new Map()
  const exports = {}
  vm.runInNewContext(code, {
    exports, URL, URLSearchParams, AbortSignal, setTimeout, fetch: fetcher, window: { location: { origin: 'http://localhost:3000' } },
    require: (name) => name === '@/features/life/locateRegion' ? regionExports : name === '@/lib/storage'
      ? { readJSON: (key) => cache.get(key), writeJSON: (key, value) => cache.set(key, value) } : require(name),
  })
  return exports
}
const signal = () => new AbortController().signal
const ok = (data) => ({ ok: true, json: async () => data })
const fixture = (date = setup().koreaTime().slice(0, 10)) => ({
  current: { time: `${date}T12:00`, temperature_2m: 17.1, weather_code: 2, is_day: 1 },
  daily: { time: [date], temperature_2m_min: [null], temperature_2m_max: [20], precipitation_probability_max: [0] },
  hourly: { time: [`${date}T12:00`], temperature_2m: [17], weather_code: [2], precipitation_probability: [null], is_day: [1] },
})

test('한국 날짜 경계와 기온·강수확률 누락을 처리한다', () => {
  const api = setup()
  assert.equal(api.koreaTime(Date.parse('2026-10-26T15:30:00Z')), '2026-10-27T00:30')
  assert.equal(api.temperatureText(null), '—')
  assert.equal(api.temperatureText(-2.4), '-2°')
  assert.equal(api.probabilityText(null), '정보 없음')
  assert.equal(api.probabilityText(0), '0%')
  assert.equal(api.weatherDescription(0, false).icon, '🌙')
  assert.equal(api.weatherDescription(95).text, '뇌우')
  assert.equal(api.weatherDescription(999).text, '날씨 정보 없음')
})

test('시간별 예보는 한국 현재 시각부터 자정을 넘어 12개를 보여준다', () => {
  const api = setup()
  const data = fixture('2026-10-26')
  data.hourly.time = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 9, 26, i)).toISOString().slice(0, 16))
  const hours = api.upcomingHours(data, Date.parse('2026-10-26T14:45:00Z'))
  assert.equal(hours.length, 12)
  assert.equal(hours[0].time, '2026-10-26T23:00')
  assert.equal(hours[1].time, '2026-10-27T00:00')
})

test('전체 지역명을 확인하고 좌표를 캐시해 중복 조회하지 않는다', async () => {
  let count = 0
  const api = setup(async (url) => {
    count++
    assert.equal(new URL(url).searchParams.get('q'), '서울 마포구')
    return ok([{ lat: '37.56', lon: '126.90', display_name: '마포구, 서울특별시, 대한민국' }])
  })
  const place = await api.resolveWeatherPlace('서울특별시 마포구', signal())
  assert.equal(place.latitude, 37.56)
  assert.equal((await api.resolveWeatherPlace('서울 마포구', signal())).name, '서울 마포구')
  assert.equal(count, 1)
})

test('일치하지 않는 지역과 중복 지역을 임의로 선택하지 않는다', async () => {
  const missing = setup(async () => ok([{ lat: '35', lon: '129', display_name: '해운대구, 부산광역시, 대한민국' }]))
  await assert.rejects(missing.resolveWeatherPlace('서울 마포구', signal()), /동네를 찾기/)
  const ambiguous = setup(async () => ok([
    { lat: '37', lon: '126', display_name: '중구, 서울특별시, 대한민국' },
    { lat: '35', lon: '129', display_name: '중구, 부산광역시, 대한민국' },
  ]))
  await assert.rejects(ambiguous.resolveWeatherPlace('중구', signal()), /시·군·구/)
})

test('실제 응답 형식을 읽으며 오류 응답·기온 누락·지난 날짜는 실패로 처리한다', async () => {
  const place = { latitude: 37.56, longitude: 126.90, name: '서울 마포구' }
  const valid = setup(async (url) => {
    assert.equal(new URL(url).searchParams.get('timezone'), 'Asia/Seoul')
    return ok(fixture())
  })
  assert.equal((await valid.fetchForecast(place, signal())).current.temperature_2m, 17.1)
  const httpError = setup(async () => ({ ok: false }))
  await assert.rejects(httpError.fetchForecast(place, signal()), /연결하지 못/)
  const noTemperature = fixture()
  noTemperature.current.temperature_2m = null
  await assert.rejects(setup(async () => ok(noTemperature)).fetchForecast(place, signal()), /정보를 받지 못/)
  await assert.rejects(setup(async () => ok(fixture('2000-01-01'))).fetchForecast(place, signal()), /정보를 받지 못/)
})
