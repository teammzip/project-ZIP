import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// 지도 저장 리스트 이름 · 색 바꾸기: 모의 모드 저장소 규칙(updateListLocal)과 서버 요청(mapApi.updatePlaceList)
const require = createRequire(import.meta.url)
const transpile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText

function loadStore() {
  const memory = new Map()
  const localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) }
  const exports = {}
  const modules = {
    zustand: require('zustand'),
    'zustand/middleware': require('zustand/middleware'),
    './data/places': { DEFAULT_CATS: [], PLACES: {} },
    './kakaoPlaceId': { isKakaoPlace: (key) => String(key).startsWith('kakao:') },
  }
  // 리스트 번호가 local-<시각> 이라 같은 1/1000초에 두 개를 만들면 겹침 → 테스트에서는 시각을 1씩 늘림
  let tick = 1_700_000_000_000
  const FakeDate = { now: () => tick++ }
  vm.runInNewContext(transpile('../src/features/map/store.ts'), { exports, require: (name) => modules[name], localStorage, Date: FakeDate, console })
  return exports.useMapStore
}

test('이름 · 색을 바꿔도 담긴 장소는 그대로 남는다', () => {
  const store = loadStore()
  const list = store.getState().addListLocal('맛집', '#03c75a')
  store.setState({ lists: store.getState().lists.map((l) => (l.id === list.id ? { ...l, placeIds: ['10', 'kakao:7'] } : l)) })
  assert.equal(store.getState().updateListLocal(list.id, '  단골집  ', '#2f80ed'), true)
  const changed = store.getState().lists.find((l) => l.id === list.id)
  assert.equal(changed.name, '단골집')
  assert.equal(changed.color, '#2f80ed')
  assert.deepEqual([...changed.placeIds], ['10', 'kakao:7'])
})

test('빈 이름 · 다른 리스트와 같은 이름 · 없는 리스트는 바꾸지 않는다', () => {
  const store = loadStore()
  const a = store.getState().addListLocal('맛집', '#03c75a')
  store.getState().addListLocal('카페', '#ff9500')
  assert.equal(store.getState().updateListLocal(a.id, '   ', '#03c75a'), false)
  assert.equal(store.getState().updateListLocal(a.id, '카페', '#03c75a'), false)
  assert.equal(store.getState().updateListLocal('local-없음', '새이름', '#03c75a'), false)
  assert.equal(store.getState().lists.find((l) => l.id === a.id).name, '맛집')
  // 자기 이름 그대로 색만 바꾸는 것은 허용
  assert.equal(store.getState().updateListLocal(a.id, '맛집', '#ff5a7e'), true)
})

test('서버 모드는 PATCH /me/place-lists/{id} 로 이름과 색을 보낸다', async () => {
  const calls = []
  const exports = {}
  const modules = {
    zustand: require('zustand'),
    '@/lib/apiClient': { apiClient: { patch: async (...args) => { calls.push(args) } } },
    './store': {},
    './kakaoPlaceId': {},
  }
  vm.runInNewContext(transpile('../src/features/map/api.ts'), { exports, require: (name) => modules[name] ?? {} })
  await exports.mapApi.updatePlaceList('12', '단골집', '#2f80ed')
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], '/me/place-lists/12')
  assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({ name: '단골집', color: '#2f80ed' }))
})
