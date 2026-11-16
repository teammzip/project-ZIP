import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const policy = {}
vm.runInNewContext(compile('../src/features/life/billingTimeZone.ts'), { exports: policy, Intl })
const input = (patch = {}) => ({ address: { label: '서울 마포구' }, deviceZone: 'Europe/Berlin', signal: new AbortController().signal,
  addressZone: async () => 'Asia/Seoul', locationZone: async () => 'America/New_York', ...patch })

test('등록 주소가 확인되면 위치와 기기 시간대보다 우선하고 GPS를 요청하지 않는다', async () => {
  let gps = 0
  const choice = await policy.resolveBillingTimeZone(input({ locationZone: async () => { gps++; return 'America/New_York' } }))
  assert.equal(choice.timeZone, 'Asia/Seoul'); assert.equal(choice.source, 'address'); assert.equal(gps, 0)
})
test('주소가 없거나 확인에 실패하면 실제 위치 시간대를 사용한다', async () => {
  for (const patch of [{ address: { label: '' } }, { addressZone: async () => { throw new Error('not found') } }]) {
    const choice = await policy.resolveBillingTimeZone(input(patch))
    assert.equal(choice.timeZone, 'America/New_York'); assert.equal(choice.source, 'location')
  }
})
test('주소 실패와 위치 권한 거부가 겹치면 기기 시간대를 사용한다', async () => {
  const choice = await policy.resolveBillingTimeZone(input({ addressZone: async () => 'invalid-zone', locationZone: async () => { throw new Error('denied') } }))
  assert.equal(choice.timeZone, 'Europe/Berlin'); assert.equal(choice.source, 'device')
})
test('등록 주소는 본인의 집 주소·설문·가입 주소 순이며 다른 회원의 좌표는 사용하지 않는다', () => {
  const user = { id: 'a', address: '가입 주소' }
  const survey = { userId: 'a', address: '설문 주소', addressPoint: { lat: 40, lon: -74 } }
  assert.equal(policy.registeredBillingAddress(user, '집 주소', survey).label, '집 주소')
  assert.equal(policy.registeredBillingAddress(user, '집 주소', survey).point, undefined)
  assert.equal(policy.registeredBillingAddress(user, '', survey).point.lat, 40)
  assert.equal(policy.registeredBillingAddress(user, '', { ...survey, userId: 'b' }).label, '가입 주소')
  assert.equal(policy.registeredBillingAddress(user, '', { ...survey, userId: 'b' }).point, undefined)
})
test('주소 확인 중 계정·주소가 바뀌어 중단되면 GPS로 이어가지 않는다', async () => {
  const controller = new AbortController(); let done; let gps = 0
  const pending = policy.resolveBillingTimeZone(input({ signal: controller.signal, addressZone: () => new Promise((resolve) => { done = resolve }), locationZone: async () => { gps++; return 'America/New_York' } }))
  controller.abort(); done('Asia/Seoul')
  await assert.rejects(pending)
  assert.equal(gps, 0)
})

function provider() {
  const exports = {}, calls = []
  let positions = 0
  const readMapPoint = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 ? p : null
  vm.runInNewContext(compile('../src/features/life/billingTimeZoneApi.ts'), {
    exports, URL, URLSearchParams, AbortSignal, Date, setTimeout,
    fetch: async (url) => {
      calls.push(url)
      if (url.hostname.includes('nominatim')) return { ok: true, json: async () => [{ lat: '40.7128', lon: '-74.006' }] }
      return { ok: true, json: async () => ({ timezone: 'America/New_York' }) }
    },
    require: (name) => name === './billingTimeZone' ? policy : { readMapPoint, getCurrentMapPosition: async () => { positions++; return { lat: 40.7128, lon: -74.006 } } },
  })
  return { ...exports, calls, positions: () => positions }
}
test('국내 등록 주소는 상세주소 외부 전송 없이 서울 시간대를 결정한다', async () => {
  const p = provider()
  for (const label of ['서울특별시 마포구', '경기도 성남시', '부산 해운대구', '제주특별자치도 제주시']) {
    assert.equal(await p.addressTimeZone({ label }, new AbortController().signal), 'Asia/Seoul')
  }
  assert.equal(p.calls.length, 0)
})
test('해외 주소와 GPS 좌표는 자동 시간대를 조회하고 성공 결과를 캐시한다', async () => {
  const p = provider(), signal = new AbortController().signal
  assert.equal(await p.addressTimeZone({ label: 'New York, USA' }, signal), 'America/New_York')
  assert.equal(p.calls.length, 2)
  assert.equal(p.calls[1].searchParams.get('timezone'), 'auto')
  assert.equal(await p.addressTimeZone({ label: 'New York, USA' }, signal), 'America/New_York')
  assert.equal(p.calls.length, 2)
  assert.equal(await p.locationTimeZone(signal), 'America/New_York')
  assert.equal(p.positions(), 1)
})
