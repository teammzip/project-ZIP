import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// 내 정보 › AI 대화 기록: 목록 조회와 한 건 삭제 (features/ai/api.ts)
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
