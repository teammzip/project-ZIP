import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
function evaluate(file, mocks = {}, globals = {}) {
  const exports = {}
  vm.runInNewContext(compile(file), { exports, require: (name) => name in mocks ? mocks[name] : require(name), ...globals })
  return exports
}
const pointApi = evaluate('../src/features/map/location.ts')
const dateApi = evaluate('../src/lib/date.ts')
const paymentApi = evaluate('../src/features/life/payments.ts')
const policy = evaluate('../src/features/life/neighborhood.ts', { '@/features/map/location': pointApi })
const addressApi = evaluate('../src/features/onboarding/addressResult.ts', { '@/features/map/location': pointApi })
const regionApi = evaluate('../src/features/life/regionVerification.ts')
const member = { id: 'member-a', address: '서울특별시 마포구' }
const surveyPoint = { lat: 37.55, lon: 126.91 }
const verifiedPoint = { lat: 35.16, lon: 129.06 }
const survey = { userId: member.id, address: '서울특별시 마포구 합정동', addressPoint: surveyPoint }

function setup(initialSaved) {
  let auth = { user: member, token: 'test-token' }
  let saved = initialSaved ?? null
  const authStore = (selector) => selector(auth)
  authStore.getState = () => auth
  const storeExports = evaluate('../src/features/life/store.ts', {
    '@/lib/date': dateApi,
    './payments': paymentApi,
    '@/features/map/location': pointApi,
    '@/features/auth/store/authStore': { useAuthStore: authStore },
    './data/seed': { seedBills: () => [], seedEvents: () => [], seedIncomes: () => [], seedSpends: () => [] },
    './data/presets': { UNCATEGORIZED: '미분류', defaultCategories: () => [] },
    'zustand/middleware': {
      ...require('zustand/middleware'),
      persist: (initializer, options) => require('zustand/middleware').persist(initializer, {
        ...options, storage: { getItem: () => saved, setItem: (_key, value) => { saved = JSON.parse(JSON.stringify(value)) }, removeItem: () => { saved = null } },
      }),
    },
  })
  return {
    store: storeExports.useLifeStore,
    saved: () => saved,
    login: (user) => { auth = { user, token: user ? 'test-token' : null } },
  }
}
function saveSurvey(ctx) {
  ctx.store.getState().saveSettings({ ...ctx.store.getState().settings, region: survey.address, regionLocation: { userId: member.id, region: survey.address, point: surveyPoint, source: 'survey' } })
}
function selection(ctx, user = member) {
  const state = ctx.store.getState()
  return policy.selectNeighborhood(user, state.settings, survey, state.regionVerify)
}

test('주소 검색 결과에서 같은 동네 이름과 좌표를 함께 선택한다', () => {
  const result = { name: '합정동', lat: '37.55', lon: '126.91', addresstype: 'suburb', address: { country_code: 'kr', state: '서울특별시', borough: '마포구', suburb: '합정동' } }
  const option = addressApi.addressOption(result)
  assert.equal(option.address, survey.address)
  assert.equal(option.point.lat, surveyPoint.lat)
  assert.equal(addressApi.addressOption({ ...result, lat: '' }), null)
  assert.equal(addressApi.addressOption({ ...result, lon: 'Infinity' }), null)
  assert.equal(addressApi.addressOption({ ...result, addresstype: 'house' }), null)
})

test('설문 저장 후 GPS 없이 설문 주소와 좌표를 기본 지역으로 사용한다', () => {
  const ctx = setup()
  saveSurvey(ctx)
  const result = selection(ctx)
  assert.equal(result.source, 'survey')
  assert.equal(result.region, survey.address)
  assert.equal(result.point.lat, surveyPoint.lat)
  assert.equal(ctx.store.getState().regionVerify, null)
})

test('위치 인증 후 인증 지역과 실제 GPS 좌표가 설문 주소보다 우선한다', () => {
  const ctx = setup()
  saveSurvey(ctx)
  ctx.store.getState().verifyRegion('부산 해운대구', verifiedPoint)
  const result = selection(ctx)
  assert.equal(result.source, 'verified')
  assert.equal(result.region, '부산 해운대구')
  assert.equal(result.point.lon, verifiedPoint.lon)
  const reloaded = setup(ctx.saved())
  assert.equal(selection(reloaded).point.lat, verifiedPoint.lat)
})

test('동네 이름이 같아도 다시 인증한 좌표로 갱신하고 잘못된 좌표는 적용하지 않는다', () => {
  const ctx = setup()
  saveSurvey(ctx)
  ctx.store.getState().verifyRegion(survey.address, { lat: 37.559, lon: 126.919 })
  assert.equal(selection(ctx).point.lat, 37.559)
  assert.equal(selection(ctx).source, 'verified')
  ctx.store.getState().verifyRegion('잘못된 위치', { lat: NaN, lon: 127 })
  assert.equal(selection(ctx).point.lat, 37.559)
  assert.equal(selection(ctx).region, survey.address)
})

test('동네 이름을 수동 변경하면 이전 좌표와 인증을 재사용하지 않는다', () => {
  const ctx = setup()
  saveSurvey(ctx)
  ctx.store.getState().verifyRegion('부산 해운대구', verifiedPoint)
  ctx.store.getState().saveSettings({ ...ctx.store.getState().settings, region: '대전 유성구' })
  const result = selection(ctx)
  assert.equal(result.region, '대전 유성구')
  assert.equal(result.point, null)
  assert.equal(result.source, 'manual')
  assert.equal(ctx.store.getState().regionVerify, null)
})

test('다른 회원과 로그아웃 화면에 이전 회원의 위치를 노출하지 않는다', () => {
  const ctx = setup()
  saveSurvey(ctx)
  ctx.store.getState().verifyRegion('부산 해운대구', verifiedPoint)
  const result = selection(ctx, { id: 'member-b', address: '대전 유성구' })
  assert.equal(result.region, '대전 유성구')
  assert.equal(result.point, null)
  assert.equal(selection(ctx, null).region, '')
})

test('날씨와 홈·동네 지도는 같은 선택 좌표를 사용하며 인증 좌표는 추가 검색하지 않는다', () => {
  const ctx = setup()
  saveSurvey(ctx)
  for (const verified of [false, true]) {
    if (verified) ctx.store.getState().verifyRegion('부산 해운대구', verifiedPoint)
    const queries = []
    const hook = evaluate('../src/features/life/useNeighborhoodLocation.ts', {
      '@tanstack/react-query': { useQuery: (options) => { queries.push(options); return { isPending: true, isFetching: false, data: undefined, error: null } } },
      '@/features/auth/store/authStore': { useAuthStore: (select) => select({ user: member }) },
      '@/features/onboarding/store': { useHousingSurveyStore: (select) => select({ survey }) },
      '@/features/weather/api': { resolveWeatherPlace: () => { throw new Error('저장한 좌표에는 재검색 불필요') } },
      './store': { useLifeStore: (select) => select(ctx.store.getState()) },
      './neighborhood': policy,
      './regionVerification': regionApi,
    })
    const location = hook.useNeighborhoodLocation()
    const mapHook = evaluate('../src/features/map/useNeighborhoodPosition.ts', { '@/features/life/useNeighborhoodLocation': { useNeighborhoodLocation: () => location } })
    const map = mapHook.useNeighborhoodPosition()
    assert.equal(map.point.lat, location.place.latitude)
    assert.equal(map.point.lon, location.place.longitude)
    assert.equal(map.region, verified ? '부산 해운대구' : survey.address)
    assert.equal(queries[0].enabled, false)
    assert.equal(location.loading, false)
    assert.equal(!!location.verifiedPoint, verified)
  }
})

test('좌표가 없는 기존 설문은 그 주소의 지역 검색으로 복원한다', () => {
  const result = policy.selectNeighborhood(member, { region: '다른 회원의 예전 동네' }, { ...survey, addressPoint: undefined }, null)
  assert.equal(result.region, survey.address)
  assert.equal(result.point, null)
  assert.equal(result.source, 'survey')
})
