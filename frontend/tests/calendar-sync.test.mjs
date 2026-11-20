import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

/* 일정 서버 동기화(features/life/calendarSync.ts)를 진짜 생활 저장소(store.ts) + 가짜 서버로 확인:
 * 카테고리를 만들자마자 그 카테고리 일정을 넣어도 순서대로 가고, 이름 바꾸기 · 지우기는 카테고리 요청 하나로 끝나고(일정을 하나씩 다시 보내지 않음),
 * 서버 연결 전 기록은 한 번 옮기고, 이 기기 기록 초기화 · 다른 회원으로 바뀔 때는 서버 일정을 건드리지 않음 */

const require = createRequire(import.meta.url)
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const plain = (value) => JSON.parse(JSON.stringify(value))
const settle = async () => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r))
}
const http = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })
const DEFAULTS = ['집 관리', '청소·빨래', '돈·계약', '건강·생활', '연락·행정']

function setup({ events = [], local = {}, synced = true } = {}) {
  // ---- 가짜 서버 ----
  const server = { cats: [], presets: [], events: new Map(), next: 500, calls: [] }
  const addCat = (name, system = false) => server.cats.push({ id: String(server.next++), name, ico: system ? '📌' : '🏷️', system, items: [] })
  DEFAULTS.forEach((n) => addCat(n))
  addCat('미분류', true)
  for (const e of events) server.events.set(e.id, { done: false, category: null, anniv: false, yearly: false, time: '', ...e })
  const catName = (id) => server.cats.find((c) => c.id === id)?.name
  const toServer = (e) => ({ ...e, id: String(e.id) })
  async function respond(method, url, body) {
    server.calls.push([method, url, body && structuredClone(body)])
    const [, path, id] = url.split('/')
    if (path === 'event-categories') {
      const sorted = () => [...server.cats.filter((c) => !c.system), ...server.cats.filter((c) => c.system)]
      if (method === 'GET') return sorted()
      if (method === 'POST') {
        if (server.cats.some((c) => c.name === body.name)) throw http(409)
        addCat(body.name)
        return server.cats.at(-1)
      }
      const cat = server.cats.find((c) => c.id === id)
      if (!cat) throw http(404)
      if (method === 'PATCH') {
        for (const e of server.events.values()) if (e.category === cat.name) e.category = body.name
        cat.name = body.name
        return null
      }
      if (method === 'DELETE') {
        for (const e of server.events.values()) if (e.category === cat.name) e.category = '미분류'
        server.cats.splice(server.cats.indexOf(cat), 1)
        return null
      }
    }
    if (path === 'event-presets') {
      if (method === 'GET') return server.presets
      if (method === 'POST') {
        const p = { id: String(server.next++), title: body.title, category: body.category }
        server.presets.push(p)
        return p
      }
      const p = server.presets.find((x) => x.id === id)
      if (!p) throw http(404)
      if (method === 'DELETE') return server.presets.splice(server.presets.indexOf(p), 1), null
      return Object.assign(p, body)
    }
    if (path === 'events') {
      if (method === 'GET') return [...server.events.values()].map(toServer)
      if (body?.category && !server.cats.some((c) => c.name === body.category)) throw http(400) // 없는 카테고리
      if (method === 'POST') {
        const e = { ...body, id: server.next++, category: body.category || null }
        server.events.set(e.id, e)
        return toServer(e)
      }
      const e = server.events.get(Number(id))
      if (!e) throw http(404)
      if (method === 'DELETE') return server.events.delete(Number(id)), null
      Object.assign(e, body, { category: body.category || null })
      return toServer(e)
    }
    throw new Error('unknown ' + method + ' ' + url)
  }
  void catName
  const api = Object.fromEntries(['get', 'post', 'patch', 'put', 'delete'].map((m) => [m, (url, body) => respond(m.toUpperCase(), url, body).then((data) => ({ data }))]))

  // ---- 진짜 생활 저장소 (회원 · 저장소만 가짜) ----
  let auth = { user: { id: 'u1' }, token: 't' }
  const authListeners = []
  const useAuthStore = Object.assign((selector) => selector(auth), {
    getState: () => auth,
    subscribe: (listener) => (authListeners.push(listener), () => {}),
  })
  const saved = new Map()
  if (synced) {
    saved.set('zip-events-synced:u1', '1')
    saved.set('zip-calendar-categories-synced:u1', '1')
  }
  const localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, String(v)), removeItem: (k) => saved.delete(k) }
  const evaluate = (file, mocks, extra = {}) => {
    const exports = {}
    vm.runInNewContext(compile(file), { exports, localStorage, structuredClone, setTimeout, clearTimeout, console, crypto: globalThis.crypto, ...extra,
      require: (name) => (name in mocks ? mocks[name] : require(name)) })
    return exports
  }
  const hooks = evaluate('../src/features/life/calendarHooks.ts', {})
  const presets = evaluate('../src/features/life/data/presets.ts', {})
  const listSync = evaluate('../src/lib/listSync.ts', {})
  const storeModule = evaluate('../src/features/life/store.ts', {
    '@/lib/date': evaluate('../src/lib/date.ts', {}),
    './payments': evaluate('../src/features/life/payments.ts', {}),
    '@/features/map/location': evaluate('../src/features/map/location.ts', {}),
    '@/features/auth/store/authStore': { useAuthStore },
    './data/seed': { stripLegacySamples: () => {}, todosToEvents: () => [] },
    './data/presets': presets,
    './calendarHooks': hooks,
  })
  const store = storeModule.useLifeStore
  store.setState({ ...local })
  const timers = []
  const setTimer = (fn) => (timers.push(fn), timers.length)
  const clearTimer = (n) => (timers[n - 1] = null)
  const sync = evaluate('../src/features/life/calendarSync.ts', {
    react: { useEffect: () => {} },
    '@/features/auth/store/authStore': { useAuthStore },
    '@/lib/apiClient': { apiClient: api },
    '@/lib/apiMode': { isMockApi: false },
    '@/lib/listSync': listSync,
    './calendarHooks': hooks,
    './data/presets': presets,
    './store': storeModule,
  })
  const runTimers = async (rounds = 6) => {
    for (let r = 0; r < rounds; r++) {
      const due = timers.splice(0).filter(Boolean)
      if (!due.length) break
      due.forEach((fn) => fn())
      await settle()
    }
  }
  const start = () => sync.startCalendarSync('u1', setTimer, clearTimer)
  const switchUser = (id) => {
    const previous = auth
    auth = { user: id ? { id } : null, token: id ? 't2' : null }
    authListeners.forEach((l) => l(auth, previous))
  }
  return { server, store, start, settle, runTimers, sync, switchUser, saved, calls: (m, path) => server.calls.filter(([cm, u]) => cm === m && u.startsWith(path)) }
}

test('서버 카테고리 · 일정을 받아 화면 저장소에 넣는다', async () => {
  const t = setup({ events: [{ id: 1, date: '2026-11-24', title: '택배 반품', category: '연락·행정' }] })
  t.start()
  await t.settle()
  const s = t.store.getState()
  assert.deepEqual(plain(s.categories.map((c) => c.name)), [...DEFAULTS, '미분류'])
  assert.deepEqual(plain(s.events.map((e) => [e.id, e.title, e.category])), [[1, '택배 반품', '연락·행정']])
})

test('카테고리를 만들자마자 그 카테고리 일정을 넣어도 카테고리가 먼저 저장된다', async () => {
  const t = setup()
  t.start()
  await t.settle()
  assert.equal(t.store.getState().addCategory('반려동물'), null)
  t.store.getState().addEvent({ title: '사료 주문', date: '2026-11-25', time: '', category: '반려동물' })
  await t.settle()
  await t.runTimers()
  const posted = [...t.server.events.values()]
  assert.deepEqual(plain(posted.map((e) => [e.title, e.category])), [['사료 주문', '반려동물']])
  const order = t.server.calls.filter(([m]) => m === 'POST').map(([, u]) => u)
  assert.deepEqual(order, ['/event-categories', '/events'])
})

test('카테고리 이름 바꾸기 · 지우기는 카테고리 요청 하나로 끝나고 일정은 서버를 따라간다', async () => {
  const t = setup({ events: [{ id: 1, date: '2026-11-24', title: '집주인 통화', category: '연락·행정' }] })
  t.start()
  await t.settle()
  t.store.getState().renameCategory('연락·행정', '연락')
  await t.settle()
  await t.runTimers()
  assert.equal(t.server.events.get(1).category, '연락')
  assert.equal(t.calls('PATCH', '/events').length, 0, '일정을 하나씩 다시 보내지 않음')
  t.store.getState().deleteCategory('연락')
  await t.settle()
  await t.runTimers()
  assert.equal(t.server.events.get(1).category, '미분류')
  assert.equal(t.store.getState().events[0].category, '미분류')
  assert.equal(t.calls('PATCH', '/events').length, 0)
  assert.ok(!t.server.cats.some((c) => c.name === '연락'))
})

test('직접 만든 항목 버튼을 만들고 고치고 지우면 서버도 같이 바뀐다', async () => {
  const t = setup()
  t.start()
  await t.settle()
  t.store.getState().addPreset('화분 물 주기', '집 관리')
  const localId = t.store.getState().customPresets[0].id
  t.store.getState().updatePreset(localId, '화분 분갈이', '건강·생활')
  await t.settle()
  assert.deepEqual(plain(t.server.presets.map((p) => [p.title, p.category])), [['화분 분갈이', '건강·생활']])
  t.store.getState().removePreset(localId)
  await t.settle()
  assert.equal(t.server.presets.length, 0)
})

test('서버 연결 전에 만든 카테고리 · 항목 · 일정은 한 번만 서버로 옮긴다', async () => {
  const local = {
    categories: [...DEFAULTS.map((name) => ({ name, ico: '🏠', items: [] })), { name: '반려동물', ico: '🏷️', items: [] }, { name: '미분류', ico: '📌', items: [] }],
    customPresets: [{ id: 'p1', title: '사료 주문', category: '반려동물' }],
    events: [{ id: 9001, date: '2026-11-20', time: '', title: '병원', category: '반려동물', done: false }, { id: 9002, date: '2026-12-25', time: '', title: '🎉 기념일', anniv: true, yearly: true }],
  }
  const t = setup({ local, synced: false })
  const first = t.start()
  await t.settle()
  await t.runTimers()
  assert.ok(t.server.cats.some((c) => c.name === '반려동물'))
  assert.deepEqual(plain(t.server.presets.map((p) => p.title)), ['사료 주문'])
  assert.deepEqual(plain([...t.server.events.values()].map((e) => [e.title, e.category]).sort()), [['병원', '반려동물'], ['🎉 기념일', null]])
  assert.equal(t.saved.get('zip-events-synced:u1'), '1')
  assert.equal(t.saved.get('zip-calendar-categories-synced:u1'), '1')
  // 앱을 닫았다 다시 열어도 또 올리지 않음
  first()
  const posts = t.calls('POST', '/events').length
  const again = t.start()
  await t.settle()
  await t.runTimers()
  again()
  assert.equal(t.calls('POST', '/events').length, posts)
})

test('이 기기 기록 초기화는 서버 일정을 지우지 않고 다시 받아 온다', async () => {
  const t = setup({ events: [{ id: 1, date: '2026-11-24', title: '서버 일정' }] })
  t.start()
  await t.settle()
  t.sync.withoutCalendarSync(() => t.store.getState().reset())
  await t.settle()
  await t.runTimers()
  assert.equal(t.calls('DELETE', '/events').length, 0)
  assert.deepEqual(plain(t.store.getState().events.map((e) => e.title)), ['서버 일정'])
})

test('다른 회원으로 바뀌는 순간 저장소가 바뀌어도 서버에 보내지 않는다', async () => {
  const t = setup({ events: [{ id: 1, date: '2026-11-24', title: 'u1 일정' }] })
  t.start()
  await t.settle()
  t.switchUser('u2') // 저장소가 비워지고 u2 사본을 읽음
  t.store.setState({ events: [{ id: 77, date: '2026-11-24', time: '', title: 'u2 일정', done: false }] })
  await t.settle()
  await t.runTimers()
  assert.equal(t.calls('POST', '/events').length, 0)
  assert.equal(t.calls('DELETE', '/events').length, 0)
})

test('일정 완료 체크 · 수정 · 삭제가 서버에 간다', async () => {
  const t = setup({ events: [{ id: 1, date: '2026-11-24', title: '이불 빨래', category: '청소·빨래' }] })
  t.start()
  await t.settle()
  t.store.getState().toggleEvent(1, true)
  await t.runTimers()
  assert.equal(t.server.events.get(1).done, true)
  t.store.getState().updateEvent({ ...t.store.getState().events[0], title: '이불 빨래 + 건조', time: '20:00' })
  await t.runTimers()
  assert.equal(t.server.events.get(1).title, '이불 빨래 + 건조')
  assert.equal(t.server.events.get(1).time, '20:00')
  t.store.getState().removeEvent(1)
  await t.settle()
  assert.equal(t.server.events.size, 0)
})
