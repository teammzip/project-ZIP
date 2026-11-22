// 날씨를 주거 설문 주소 기준으로: 설문 주소(좌표가 없을 때) → 시 · 도 + 시 · 군 · 구, 전남광주는 새 이름 → 예전 이름 순서로 검색
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
function evaluate(file, mocks = {}, globals = {}) {
  const exports = {}
  vm.runInNewContext(compile(file), { exports, require: (name) => name in mocks ? mocks[name] : require(name), ...globals })
  return exports
}
const regions = evaluate('../src/features/auth/data/regions.ts')
const locate = evaluate('../src/features/life/locateRegion.ts')
const { addressWeatherRegion } = evaluate('../src/features/weather/addressRegion.ts', {
  '@/features/auth/data/regions': regions, '@/features/life/locateRegion': locate,
})
const { osmQueries } = evaluate('../src/features/weather/api.ts', {
  '@/features/life/locateRegion': locate, '@/lib/storage': { readJSON: () => undefined, writeJSON: () => {} },
}, { URL, URLSearchParams, AbortSignal, setTimeout, window: { location: { origin: 'http://localhost:3000' } } })

test('주소에서 시 · 도 + 시 · 군 · 구만 뽑음 (도로명 · 호수는 버림)', () => {
  assert.equal(addressWeatherRegion('서울특별시 마포구 월드컵북로 396 101호'), '서울 마포구')
  assert.equal(addressWeatherRegion('서울 마포구 합정동'), '서울 마포구')
  assert.equal(addressWeatherRegion('충청북도 청주시 상당구 상당로 1'), '충북 청주시')
  assert.equal(addressWeatherRegion('경기도 성남시 분당구 정자동'), '경기 성남시')
  assert.equal(addressWeatherRegion('광주광역시 북구 용봉동'), '전남광주 북구')
  assert.equal(addressWeatherRegion('세종특별자치시 한누리대로 2130'), '세종')
})

test('시 · 도 없이 쓴 주소는 시 · 군 · 구가 전국에 하나뿐일 때만', () => {
  assert.equal(addressWeatherRegion('마포구 합정동'), '서울 마포구')
  assert.equal(addressWeatherRegion('중구 명동'), '') // 서울 · 부산 · 대구 … 여러 곳
  assert.equal(addressWeatherRegion(''), '')
  assert.equal(addressWeatherRegion('서울 어딘가'), '') // 시 · 군 · 구 없음 → 동네 기준으로 돌아감
})

test('전남광주는 새 이름으로 먼저, 없으면 예전 이름으로 찾음', () => {
  assert.deepEqual([...osmQueries('전남광주 북구')], ['전남광주통합특별시 북구', '광주광역시 북구'])
  assert.deepEqual([...osmQueries('전남광주 순천시')], ['전남광주통합특별시 순천시', '전라남도 순천시'])
  assert.deepEqual([...osmQueries('서울 마포구')], ['서울 마포구'])
})

const { addressCandidates } = evaluate('../src/features/weather/addressRegion.ts', {
  '@/features/auth/data/regions': regions, '@/features/life/locateRegion': locate,
})

test('주소로 좌표를 찾을 검색어: 그대로 → 번지 뺀 주소 → 시 · 군 · 구', () => {
  assert.deepEqual([...addressCandidates('서울 마포구 합정동 123-4')], ['서울 마포구 합정동 123-4', '서울 마포구 합정동', '서울 마포구'])
  assert.deepEqual([...addressCandidates('서울 마포구 망원1동 산12-3 101동 202호')], ['서울 마포구 망원1동 산12-3 101동 202호', '서울 마포구 망원1동', '서울 마포구'])
  assert.deepEqual([...addressCandidates('서울특별시 마포구 월드컵북로 396')], ['서울특별시 마포구 월드컵북로 396', '서울특별시 마포구 월드컵북로', '서울 마포구'])
  assert.deepEqual([...addressCandidates('서울 마포구')], ['서울 마포구'])
  assert.deepEqual([...addressCandidates('  ')], [])
})
