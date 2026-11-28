import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// AI 화면 왼쪽 대화 목록: 목록 조회 · 고른 대화 불러오기 · 한 건 삭제 (features/ai/api.ts) · 날짜별 묶음 (conversationGroups.ts)
const source = readFileSync(new URL('../src/features/ai/api.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } })

function load(apiClient, isMockApi = false) {
  const exports = {}
  const modules = {
    axios: { isAxiosError: (error) => error?.isAxiosError === true },
    '@/features/auth/api': { isMockApi },
    '@/lib/apiClient': { apiClient },
  }
  vm.runInNewContext(outputText, { exports, require: (name) => modules[name] })
  return exports
}

test('대화 목록은 홈 · AI 화면 구분 없이 서버 목록을 그대로 돌려준다', async () => {
  const calls = []
  const rows = [{ id: '7', title: '곰팡이 제거', topic: 'clean', entryPoint: 'AI_PAGE', updatedAt: '2026-11-28T05:00:00Z' }]
  const api = load({ get: async (url, config) => { calls.push([url, config]); return { data: rows } } })
  assert.deepEqual(await api.listConversations(), rows)
  assert.deepEqual(calls, [['/ai/conversations', undefined]])
})

test('한 건 삭제는 그 대화 주소로 DELETE 하고, 실패하면 오류를 던져 화면이 안내한다', async () => {
  const deleted = []
  const ok = load({ delete: async (url) => { deleted.push(url) } })
  await ok.deleteConversation('12')
  assert.deepEqual(deleted, ['/ai/conversations/12'])

  const failing = load({ delete: async () => { throw { isAxiosError: true, response: { status: 404 } } } })
  await assert.rejects(failing.deleteConversation('12'), (error) => error.response.status === 404)
})

test('모의 API 모드는 서버를 부르지 않는다 (대화가 이 기기에만 있음)', async () => {
  const never = async () => { throw new Error('서버를 부르면 안 됨') }
  const api = load({ get: never, delete: never }, true)
  assert.equal((await api.listConversations()).length, 0)
  await api.deleteConversation('1')
})

test('목록에서 고른 대화는 그 대화의 말풍선을 불러오고 지출 요약 · 링크 카드를 화면 모양으로 바꾼다', async () => {
  const calls = []
  const api = load({ get: async (url) => { calls.push(url); return { data: [
    { id: '1', role: 'USER', text: '이번 달 지출' },
    { id: '2', role: 'ASSISTANT', text: '요약', card: { type: 'SPEND_SUMMARY', data: { month: 11, total: 5 } } },
    { id: '3', role: 'ASSISTANT', text: '주변 찾기', card: { type: 'LINK', data: { to: '/map', nearbyKeyword: '세탁소' } } },
  ] } } })
  const msgs = await api.loadConversation('9')
  assert.deepEqual(calls, ['/ai/conversations/9/messages'])
  assert.equal(JSON.stringify(msgs.map((m) => m.role)), JSON.stringify(['user', 'bot', 'bot']))
  assert.equal(msgs[1].card.total, 5)
  assert.equal(msgs[2].nearbyKeyword, '세탁소')
})

test('고른 대화를 못 불러오면 오류를 던져 화면이 안내하고, 모의 모드는 서버를 부르지 않는다', async () => {
  const failing = load({ get: async () => { throw { isAxiosError: true, response: { status: 404 } } } })
  await assert.rejects(failing.loadConversation('9'), (error) => error.response.status === 404)
  const mock = load({ get: async () => { throw new Error('서버를 부르면 안 됨') } }, true)
  assert.equal((await mock.loadConversation('9')).length, 0)
})

const groups = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/ai/conversationGroups.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: groups, Date, Math, Number })

test('대화 목록을 오늘 · 어제 · 지난 7일 · 지난 30일 · 이전으로 묶고 서버 순서를 지킨다', () => {
  const now = new Date(2026, 10, 28, 15, 0)
  const at = (d, h = 9) => new Date(2026, 10, d, h).toISOString()
  const rows = [
    { id: 'a', title: '오늘 늦게', updatedAt: at(28, 14) },
    { id: 'b', title: '오늘 아침', updatedAt: at(28, 1) },
    { id: 'c', title: '어제', updatedAt: at(27) },
    { id: 'd', title: '5일 전', updatedAt: at(23) },
    { id: 'e', title: '20일 전', updatedAt: at(8) },
    { id: 'f', title: '오래전', updatedAt: new Date(2026, 5, 1).toISOString() },
  ]
  const result = groups.groupConversations(rows, now)
  assert.equal(JSON.stringify(result.map((g) => [g.label, g.items.map((r) => r.id)])),
    JSON.stringify([['오늘', ['a', 'b']], ['어제', ['c']], ['지난 7일', ['d']], ['지난 30일', ['e']], ['이전', ['f']]]))
  assert.equal(groups.groupConversations([], now).length, 0)
  assert.equal(JSON.stringify(groups.groupConversations([{ id: 'x', title: null, updatedAt: 'bad' }], now).map((g) => g.label)), JSON.stringify(['이전']))
})
