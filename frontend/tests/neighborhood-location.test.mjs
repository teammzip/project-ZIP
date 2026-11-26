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
const regionNames = evaluate('../src/features/life/locateRegion.ts')
const addressApi = evaluate('../src/features/onboarding/addressResult.ts', { '@/features/map/location': pointApi })
const regionApi = evaluate('../src/features/life/regionVerification.ts', { './locateRegion': regionNames })
const policy = evaluate('../src/features/life/neighborhood.ts', { '@/features/map/location': pointApi, './regionVerification': regionApi })
const member = { id: 'member-a', address: '서울특별시 마포구' }
const surveyPoint = { lat: 37.55, lon: 126.91 }
const verifiedPoint = { lat: 35.16, lon: 129.06 }
const survey = { userId: member.id, address: '서울특별시 마포구 합정동', addressPoint: surveyPoint }

function setup(initialSaved) {
  let auth = { user: member, sessionKey: 'test-token' }
  const saved = new Map(Object.entries(initialSaved ?? {}))
  const listeners = []
  const authStore = (selector) => selector(auth)
  authStore.getState = () => auth
  authStore.subscribe = (listener) => { listeners.push(listener); return () => {} }
  const globals = {
    localStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
  }
  const authModule = { useAuthStore: authStore }
  const storeExports = evaluate('../src/features/life/store.ts', {
    '@/lib/accountStorage': evaluate('../src/lib/accountStorage.ts', { '@/features/auth/store/authStore': authModule }, globals),
    '@/lib/date': dateApi,
    './payments': paymentApi,
    '@/features/map/location': pointApi,
    '@/features/auth/store/authStore': authModule,
    './data/seed': { seedBills: () => [], seedEvents: () => [], seedIncomes: () => [], seedSpends: () => [] },
    './data/presets': { UNCATEGORIZED: '미분류', defaultCategories: () => [] },
    './calendarHooks': { calendarHooks: { onOp: null, quiet: false }, quietly: (apply) => apply() },
  }, globals)
  return {
    store: storeExports.useLifeStore,
    saved: () => Object.fromEntries(saved),
    login: (user) => {
      const previous = auth
      auth = { user, sessionKey: user ? 'test-token' : null }
      listeners.forEach((listener) => listener(auth, previous))
    },
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

test('생활 기록 전체를 계정별로 저장하고 전환·새로고침 후 복원한다', () => {
  const ctx = setup()
  const a = ctx.store.getState()
  a.addBill('A 공과금', 1000, '공과금')
  a.addEvent({ date: '2026-11-09', time: '', title: 'A 일정' })
  a.addIncome({ date: '2026-11-09', cat: '급여', amount: 3000, memo: 'A 수입' })
  a.addSpend({ date: '2026-11-09', cat: '식비', amount: 500, memo: 'A 지출' })
  a.setRentPaid('2026-11', true)
  a.markRead(['a'])
  a.deleteNotis(['a'])
  a.saveSettings({ ...a.settings, rent: 77 })
  a.verifyRegion('부산 해운대구', verifiedPoint)
  ctx.store.setState({ categories: [{ name: 'A 분류', ico: '🏷️', items: [] }], customPresets: [{ id: 'a', title: 'A 항목', category: 'A 분류' }] })
  const snapshot = JSON.stringify(ctx.store.getState())

  const b = { id: 'member-b', address: '대전 유성구' }
  ctx.login(b)
  for (const key of ['bills', 'events', 'incomes', 'spends', 'customPresets']) assert.equal(ctx.store.getState()[key].length, 0)
  assert.equal(ctx.store.getState().regionVerify, null)
  assert.equal(Object.keys(ctx.store.getState().notiRead).length, 0)
  ctx.store.getState().addBill('B 공과금', 2000, '공과금')
  ctx.login(member)
  assert.equal(JSON.stringify(ctx.store.getState()), snapshot)
  const reloaded = setup(ctx.saved())
  assert.equal(JSON.stringify(reloaded.store.getState()), snapshot)
  ctx.login(b)
  assert.equal(ctx.store.getState().bills[0].name, 'B 공과금')
})

test('로그아웃 중 기록은 회원 데이터에 저장되지 않고 초기화·삭제도 현재 회원에만 적용한다', () => {
  const ctx = setup()
  ctx.store.getState().addBill('A', 100, '공과금')
  ctx.login({ id: 'member-b' })
  ctx.store.getState().addBill('B', 200, '공과금')
  const saved = JSON.stringify(ctx.saved())
  ctx.login(null)
  assert.equal(ctx.store.getState().bills.length, 0)
  ctx.store.getState().addBill('비로그인', 1, '공과금')
  assert.equal(JSON.stringify(ctx.saved()), saved)
  ctx.login(member)
  assert.equal(ctx.store.getState().bills[0].name, 'A')
  ctx.store.getState().reset()
  ctx.store.persist.clearStorage()
  assert.equal(ctx.saved()['zip-life:user:member-a'], undefined)
  ctx.login({ id: 'member-b' })
  assert.equal(ctx.store.getState().bills[0].name, 'B')
})

test('소유자가 없는 기존 공용 데이터는 보존하되 어느 계정에도 노출하지 않는다', () => {
  const legacy = JSON.stringify({ version: 5, state: { bills: [{ id: 1, name: '이전 공용 기록' }] } })
  const ctx = setup({ 'zip-life': legacy })
  assert.equal(ctx.store.getState().bills.length, 0)
  ctx.store.getState().addBill('A', 100, '공과금')
  assert.equal(ctx.saved()['zip-life'], legacy)
  ctx.login({ id: 'member-b' })
  assert.equal(ctx.store.getState().bills.length, 0)
})

test('다른 기기에서 인증한 동네는 이 브라우저에 고른 동네가 없을 때 설문 주소보다 먼저 쓴다', () => {
  const remote = { ...member, address: '', region: { id: '8', name: '중구', fullName: '서울특별시 중구' }, regionVerifiedAt: '2026-11-26T04:44:28Z' }
  const empty = { region: '' }
  // 시 · 도를 붙인 이름이라 부산 · 대구 중구와 헷갈리지 않음
  const fromServer = policy.selectNeighborhood(remote, empty, null, null)
  assert.equal(fromServer.region, '서울 중구')
  assert.equal(fromServer.point, null)
  assert.equal(fromServer.source, 'verified')
  assert.equal(policy.selectNeighborhood(remote, empty, survey, null).region, '서울 중구')
  // 이 브라우저의 설문 선택보다도 서버 인증이 먼저
  const surveyPicked = { region: survey.address, regionLocation: { userId: member.id, region: survey.address, point: surveyPoint, source: 'survey' } }
  assert.equal(policy.selectNeighborhood(remote, surveyPicked, survey, null).source, 'verified')
  // 이 브라우저에서 직접 인증 · 변경한 동네는 그대로 우선
  const manual = { region: '대전 유성구', regionLocation: { userId: member.id, region: '대전 유성구', source: 'manual' } }
  assert.equal(policy.selectNeighborhood(remote, manual, survey, null).region, '대전 유성구')
})

test('서버 인증이 없으면 지금처럼 설문 · 가입 주소를 쓰고, 둘 다 없으면 서버의 회원 동네를 쓴다', () => {
  const expired = { ...member, address: '', region: { id: '8', name: '중구', fullName: '서울특별시 중구' }, regionVerifiedAt: null }
  assert.equal(policy.selectNeighborhood(expired, { region: '' }, survey, null).source, 'survey')
  const account = policy.selectNeighborhood(expired, { region: '' }, null, null)
  assert.equal(account.region, '서울 중구')
  assert.equal(account.source, 'account')
  assert.equal(policy.selectNeighborhood({ ...expired, region: null }, { region: '' }, null, null).source, 'none')
  // 모의 모드 회원(동네 · 인증 칸 없음)은 예전 그대로
  assert.equal(policy.selectNeighborhood({ id: 'm', address: '서울 마포구' }, { region: '' }, null, null).source, 'account')
})
