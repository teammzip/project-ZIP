import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

/* 메모 서버 동기화(features/memo/sync.ts)를 가짜 서버로 확인: 느리거나 실패해도 내 변경을 잃지 않고, 지운 메모가 되살아나지 않고,
 * 같은 메모 저장은 차례대로, 서버 연결 전 메모는 중간에 끊겨도 이어서 한 번씩만 올라감 */

const require = createRequire(import.meta.url)
const { create } = require('zustand')
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const code = compile('../src/features/memo/sync.ts')
const listSyncCode = compile('../src/lib/listSync.ts') // 메모 동기화가 쓰는 공통 엔진

const network = () => Object.assign(new Error('network'), {})
const http = (status) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })
const settle = async () => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r))
}
/** vm 안에서 만든 배열을 바깥 배열로 (deepEqual 이 다른 영역의 배열을 다르게 봐서) */
const plain = (value) => JSON.parse(JSON.stringify(value))
const memo = (id, body, extra = {}) => ({ id, title: '', body, color: '노랑', pinned: false, checklist: false, items: [], createdAt: 1, updatedAt: 1, ...extra })

function setup({ server: initial = [], local = [], synced = true, moved = [] } = {}) {
  const server = { memos: new Map(), next: 100, home: null, calls: [], failures: [], gates: [], posts: 0, failPosts: new Set(), loseCompletionResponse: false }
  for (const m of initial) server.memos.set(m.id, { ...m })
  const toServer = (m) => ({ ...m, id: String(m.id), createdAt: '2026-11-19T00:00:00Z', updatedAt: '2026-11-19T00:00:00Z' })
  async function respond(method, url, body) {
    server.calls.push([method, url, body && structuredClone(body)])
    const gate = server.gates.findIndex((g) => g.method === method)
    if (gate >= 0) {
      const pending = server.gates.splice(gate, 1)[0]
      const snapshot = pending.snapshot ? [...server.memos.values()].map(toServer) : undefined
      await pending.promise
      if (snapshot) return snapshot
    }
    const fail = server.failures.findIndex((f) => f.method === method && (!f.url || url === f.url))
    if (fail >= 0) throw server.failures.splice(fail, 1)[0].error
    const id = Number(url.split('/')[2])
    if (method === 'GET' && url === '/memos') return [...server.memos.values()].map(toServer)
    if (method === 'GET') return { ids: server.home }
    if (method === 'POST') {
      if (server.failPosts.has(++server.posts)) throw network()
      const m = { ...memo(server.next++, ''), ...body }
      server.memos.set(m.id, m)
      return toServer(m)
    }
    if (method === 'PUT') return (server.home = body.ids), { ids: server.home }
    if (!server.memos.has(id)) throw http(404)
    if (method === 'PATCH') {
      const { complete, ...fields } = body
      const saved = { ...server.memos.get(id), ...fields, ...(complete ? { draft: false } : {}) }
      server.memos.set(id, saved)
      if (complete && server.loseCompletionResponse) {
        server.loseCompletionResponse = false
        throw network()
      }
      return toServer(saved)
    }
    if (method === 'DELETE') return server.memos.delete(id), null
  }
  const api = {
    get: (url) => respond('GET', url).then((data) => ({ data })),
    post: (url, body) => respond('POST', url, body).then((data) => ({ data })),
    patch: (url, body) => respond('PATCH', url, body).then((data) => ({ data })),
    put: (url, body) => respond('PUT', url, body).then((data) => ({ data })),
    delete: (url) => respond('DELETE', url).then((data) => ({ data })),
  }
  const store = create(() => ({ memos: local.map((m) => ({ ...m })), homeIds: null }))
  const saved = new Map()
  if (synced) saved.set('zip-memos-synced:u1', '1')
  if (moved.length) saved.set('zip-memos-moved:u1', JSON.stringify(moved))
  const localStorage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, String(v)), removeItem: (k) => saved.delete(k) }
  const timers = []
  const setTimer = (fn, delay) => (timers.push({ fn, delay }), timers.length)
  const clearTimer = (n) => timers[n - 1] && (timers[n - 1].fn = null)
  const exports = {}
  const window = new EventTarget()
  let auth = { user: { id: 'u1' }, sessionKey: 'session-1' }
  const listSync = {}
  vm.runInNewContext(listSyncCode, { exports: listSync, localStorage, setTimeout, clearTimeout, console })
  vm.runInNewContext(code, {
    exports, localStorage, structuredClone, setTimeout, clearTimeout, console, window,
    require: (name) => {
      if (name === 'react') return { useEffect: () => {} }
      if (name === '@/lib/listSync') return listSync
      if (name === '@/lib/apiClient') return { apiClient: api }
      if (name === '@/lib/apiMode') return { isMockApi: false }
      if (name === '@/features/auth/store/authStore') return { useAuthStore: Object.assign(() => 'u1', { getState: () => auth }) }
      if (name === './store') return { useMemoStore: store }
      return {}
    },
  })
  /** 기다리는 타이머를 모두 돌림 (저장 0.5초 · 다시 시도) */
  const runTimers = async (rounds = 5) => {
    for (let r = 0; r < rounds; r++) {
      const due = timers.splice(0).filter((t) => t.fn)
      if (!due.length) break
      for (const t of due) t.fn()
      await settle()
    }
  }
  const gate = (method, snapshot = false) => {
    let open
    server.gates.push({ method, snapshot, promise: new Promise((r) => (open = r)) })
    return () => open()
  }
  const edit = (id, patch) => store.setState((s) => ({ memos: s.memos.map((m) => (m.id === id ? { ...m, ...patch } : m)) }))
  const start = () => exports.startMemoSync('u1', setTimer, clearTimer)
  const switchAccount = () => { auth = { user: { id: 'u2' }, sessionKey: 'session-2' } }
  const refresh = () => window.dispatchEvent(new Event('zip-memos-refresh'))
  return { server, store, saved, start, settle, runTimers, gate, edit, exports, timers, switchAccount, refresh }
}

test('메모 확정은 이전 자동 저장을 기다리고 성공 응답 후 한 번만 적용한다', async () => {
  const t = setup({ server: [memo(1, '초안', { draft: true, ledgerContext: '식비' })] })
  t.start()
  await t.settle()
  const openAutosave = t.gate('PATCH')
  t.edit(1, { body: '자동 저장할 내용' })
  await t.runTimers(1)
  t.edit(1, { body: '최종 내용' })
  const openCompletion = t.gate('PATCH')
  const completion = t.exports.completeLedgerMemo(1)
  const duplicate = t.exports.completeLedgerMemo(1)
  await t.settle()
  assert.equal(t.server.calls.filter(([method]) => method === 'PATCH').length, 1)
  openAutosave()
  await t.settle()
  assert.equal(t.store.getState().memos[0].draft, true)
  openCompletion()
  const [result, second] = await Promise.all([completion, duplicate])
  assert.equal(result.body, '최종 내용')
  assert.equal(second.draft, false)
  await t.runTimers()
  assert.deepEqual(t.server.calls.filter(([method]) => method === 'PATCH').map(([, , payload]) => [payload.body, payload.complete]), [
    ['자동 저장할 내용', undefined], ['최종 내용', true],
  ])
  assert.equal(t.store.getState().memos[0].draft, false)
})

test('확정이 거절되거나 응답이 유실되어도 입력을 유지하고 같은 메모를 다시 확정한다', async () => {
  const t = setup({ server: [memo(1, '초안', { draft: true, ledgerContext: '식비' })] })
  t.start()
  await t.settle()
  t.edit(1, { body: '보존할 입력' })
  t.server.failures.push({ method: 'PATCH', error: http(400) })
  await assert.rejects(t.exports.completeLedgerMemo(1), /HTTP 400/)
  assert.equal(t.store.getState().memos[0].body, '보존할 입력')
  assert.equal(t.store.getState().memos[0].draft, true)
  t.server.loseCompletionResponse = true
  await assert.rejects(t.exports.completeLedgerMemo(1), /network/)
  assert.equal(t.server.memos.get(1).draft, false)
  assert.equal(t.store.getState().memos[0].draft, true)
  assert.equal((await t.exports.completeLedgerMemo(1)).draft, false)
  assert.equal(t.server.memos.size, 1)
  assert.equal(t.store.getState().memos[0].body, '보존할 입력')
})

test('확정 응답을 기다리는 중 계정이 바뀌면 새 계정 메모에 결과를 적용하지 않는다', async () => {
  const t = setup({ server: [memo(1, 'A 초안', { draft: true, ledgerContext: '식비' })] })
  t.start()
  await t.settle()
  const openCompletion = t.gate('PATCH')
  const completion = t.exports.completeLedgerMemo(1)
  const rejected = assert.rejects(completion, /로그인 상태가 변경/)
  await t.settle()
  t.switchAccount()
  t.store.setState({ memos: [memo(1, 'B 메모')] })
  openCompletion()
  await rejected
  assert.equal(t.store.getState().memos[0].body, 'B 메모')
})

test('확정 전 시작한 조회가 늦게 돌아와도 메모를 초안으로 되돌리지 않는다', async () => {
  const t = setup({ server: [memo(1, '초안', { draft: true, ledgerContext: '식비' })] })
  t.start()
  await t.settle()
  const openPull = t.gate('GET', true)
  t.refresh()
  await t.runTimers(1)
  await t.exports.completeLedgerMemo(1)
  openPull()
  await t.settle()
  assert.equal(t.store.getState().memos[0].draft, false)
  await t.runTimers()
  assert.equal(t.store.getState().memos[0].draft, false)
})

test('처음 불러오기 전에 고친 내용도 서버 값으로 덮이지 않고 저장된다', async () => {
  const t = setup({ server: [memo(1, '원래')], local: [memo(1, '원래')] })
  const openGet = t.gate('GET')
  t.start()
  await t.settle()
  t.edit(1, { body: '불러오기 전에 고침' }) // 서버 응답이 아직 안 옴
  openGet()
  await t.settle()
  assert.equal(t.store.getState().memos[0].body, '불러오기 전에 고침')
  await t.runTimers()
  assert.equal(t.server.memos.get(1).body, '불러오기 전에 고침')
})

test('처음 불러오기가 실패해도 다시 시도하고, 그동안 쓴 메모를 올린다', async () => {
  const t = setup({ server: [memo(1, '서버')], local: [memo(1, '서버')] })
  t.server.failures.push({ method: 'GET', error: network() })
  t.start()
  await t.settle()
  t.store.setState((s) => ({ memos: [...s.memos, memo(9_000, '오프라인에서 쓴 메모')] }))
  await t.runTimers()
  assert.deepEqual([...t.server.memos.values()].map((m) => m.body).sort(), ['서버', '오프라인에서 쓴 메모'])
  assert.equal(t.store.getState().memos.length, 2)
})

test('서버 연결 전 메모를 올리다 끊기면 다음에 이어서, 한 번씩만 올린다', async () => {
  const local = [memo(10, '하나'), memo(11, '둘'), memo(12, '셋')]
  const first = setup({ local, synced: false })
  first.server.failPosts = new Set([2, 3]) // 첫 번째(하나)만 올라가고 둘 · 셋은 네트워크 실패
  const stop = first.start()
  await first.settle()
  assert.deepEqual([...first.server.memos.values()].map((m) => m.body), ['하나'])
  stop() // 그 상태로 브라우저를 닫음
  // 다시 열기: 같은 브라우저 저장소 · 같은 서버
  const again = setup({ local: first.store.getState().memos, synced: false, moved: JSON.parse(first.saved.get('zip-memos-moved:u1') ?? '[]') })
  again.server.memos = first.server.memos
  again.server.next = first.server.next
  again.start()
  await again.settle()
  await again.runTimers()
  assert.deepEqual([...again.server.memos.values()].map((m) => m.body).sort(), ['둘', '셋', '하나'], '빠짐 · 중복 없음')
  assert.equal(again.saved.get('zip-memos-synced:u1'), '1')
  assert.equal(again.store.getState().memos.length, 3)
})

test('한 번 맞춘 브라우저의 옛 사본은 다시 올리지 않는다 (다른 기기에서 지운 메모가 안 되살아남)', async () => {
  const t = setup({ server: [], local: [memo(5, '다른 기기에서 지움')], synced: true })
  t.start()
  await t.settle()
  await t.runTimers()
  assert.equal(t.store.getState().memos.length, 0)
  assert.equal(t.server.calls.filter(([m]) => m === 'POST').length, 0)
})

test('같은 메모 저장은 차례대로 가서 늦게 도착한 옛 내용이 덮어쓰지 않는다', async () => {
  const t = setup({ server: [memo(1, '0')], local: [memo(1, '0')] })
  t.start()
  await t.settle()
  const openFirstPatch = t.gate('PATCH')
  t.edit(1, { body: '첫째' })
  await t.runTimers(1) // 첫째 PATCH 가 느린 채로 걸려 있음
  t.edit(1, { body: '둘째' })
  await t.runTimers(1) // 둘째는 첫째가 끝날 때까지 기다림
  openFirstPatch()
  await t.settle()
  await t.runTimers()
  assert.equal(t.server.memos.get(1).body, '둘째')
  assert.deepEqual(t.server.calls.filter(([m]) => m === 'PATCH').map(([, , b]) => b.body), ['첫째', '둘째'])
})

test('한 메모 저장이 실패해도 다른 메모의 기다리던 변경은 잃지 않는다', async () => {
  const t = setup({ server: [memo(1, 'A'), memo(2, 'B')], local: [memo(1, 'A'), memo(2, 'B')] })
  t.start()
  await t.settle()
  t.server.memos.delete(1) // 다른 기기에서 1번을 지움
  t.edit(1, { body: 'A 고침' })
  t.edit(2, { body: 'B 고침' })
  await t.runTimers()
  assert.equal(t.server.memos.get(2).body, 'B 고침')
  assert.deepEqual(plain(t.store.getState().memos.map((m) => m.body)), ['B 고침'], '지워진 1번은 서버를 따라 사라지고 2번 변경은 남음')
})

test('서버가 거절한 메모는 계속 다시 보내지 않는다', async () => {
  const t = setup({ local: [memo(10, '너무 긴 메모')], synced: false })
  t.server.failures.push({ method: 'POST', error: http(400) })
  t.start()
  await t.settle()
  await t.runTimers(8)
  assert.equal(t.server.calls.filter(([m]) => m === 'POST').length, 1)
  assert.equal(t.saved.get('zip-memos-synced:u1'), '1')
})

test('새 메모를 만들자마자 고치고 지워도 서버에 남지 않는다', async () => {
  const t = setup({ server: [], local: [] })
  t.start()
  await t.settle()
  const openPost = t.gate('POST')
  t.store.setState({ memos: [memo(7_000, '')] })
  await t.settle()
  t.edit(7_000, { body: '바로 고침' })
  t.store.setState({ memos: [] })
  openPost()
  await t.settle()
  await t.runTimers()
  assert.equal(t.server.memos.size, 0)
})

test('홈 메모 순서는 새 메모가 서버 번호를 받은 뒤 서버 번호로 저장된다', async () => {
  const t = setup({ server: [memo(1, '있던 메모')], local: [memo(1, '있던 메모')] })
  t.start()
  await t.settle()
  t.store.setState((s) => ({ memos: [...s.memos, memo(8_000, '새 메모')], homeIds: [8_000, 1] }))
  await t.settle()
  await t.runTimers()
  const created = [...t.server.memos.values()].find((m) => m.body === '새 메모')
  assert.ok(created)
  assert.deepEqual(t.server.home, [String(created.id), '1'])
})

test('이 기기 기록 초기화는 서버 메모를 지우지 않고 다시 받아 온다', async () => {
  const t = setup({ server: [memo(1, '서버 메모')], local: [memo(1, '서버 메모')] })
  t.start()
  await t.settle()
  t.exports.withoutMemoSync(() => t.store.setState({ memos: [], homeIds: null }))
  await t.settle()
  await t.runTimers()
  assert.equal(t.server.calls.filter(([m]) => m === 'DELETE').length, 0)
  assert.deepEqual(plain(t.store.getState().memos.map((m) => m.body)), ['서버 메모'])
})
