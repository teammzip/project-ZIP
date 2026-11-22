import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import axios, { AxiosError } from 'axios'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/apiClient.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace('import.meta.env.VITE_API_BASE_URL', 'undefined'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText

function client(refresh, { acceptRefreshed = true } = {}) {
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: () => axios, Error })
  const { apiClient, bindAuth } = exports
  let session = { key: 'first-session', token: 'expired' }
  let refreshCount = 0
  let logoutCount = 0
  const sent = []
  bindAuth({
    getSession: () => session,
    refresh: async () => {
      refreshCount++
      await refresh()
      if (session.key === 'first-session') session = { ...session, token: 'refreshed' }
    },
    onUnauthorized: () => { logoutCount++ },
    onSuspended: () => {},
  })
  apiClient.defaults.adapter = async (request) => {
    const header = request.headers.get('Authorization')
    sent.push({ header, method: request.method, data: request.data })
    const accepted = acceptRefreshed && header === 'Bearer refreshed'
    const response = { config: request, data: {}, headers: accepted ? {} : { 'www-authenticate': 'Bearer' },
      status: accepted ? 200 : 401 }
    if (!accepted) throw new AxiosError('Expired', 'ERR_BAD_REQUEST', request, null, response)
    return response
  }
  return { apiClient, sent, counts: () => [refreshCount, logoutCount],
    switchAccount: () => { session = { key: 'second-session', token: 'another-account' } } }
}

test('동시에 만료된 조회와 저장 요청은 재발급을 공유하고 원래 요청을 한 번씩 재시도한다', async () => {
  const current = client(async () => {})
  await Promise.all([current.apiClient.get('/auth/me'), current.apiClient.patch('/auth/me', { nickname: '지기' })])
  assert.deepEqual(current.counts(), [1, 0])
  const writes = current.sent.filter((request) => request.method === 'patch')
  assert.deepEqual(writes.map((request) => request.header), ['Bearer expired', 'Bearer refreshed'])
  assert.deepEqual(writes.map((request) => JSON.parse(request.data)), [{ nickname: '지기' }, { nickname: '지기' }])
})

test('통신 실패 후에도 로그인 상태를 유지하고 다음 요청에서 재발급을 다시 시도한다', async () => {
  let offline = true
  const current = client(async () => { if (offline) throw new AxiosError('offline', 'ERR_NETWORK') })
  await assert.rejects(current.apiClient.get('/auth/me'), /offline/)
  assert.deepEqual(current.counts(), [1, 0])
  offline = false
  assert.equal((await current.apiClient.get('/auth/me')).status, 200)
  assert.deepEqual(current.counts(), [2, 0])
})

test('재발급 중 로그인 계정이 바뀌면 새 계정으로 원래 저장 요청을 보내지 않는다', async () => {
  let complete
  let started
  const refreshing = new Promise((resolve) => { started = resolve })
  const current = client(() => {
    started()
    return new Promise((resolve) => { complete = resolve })
  })
  const write = current.apiClient.patch('/auth/me', { nickname: '이전 계정' })
  await refreshing
  current.switchAccount()
  complete()
  await assert.rejects(write, /로그인 상태가 변경/)
  assert.equal(current.sent.length, 1)
  assert.deepEqual(current.counts(), [1, 0])
})

test('재시도도 401이면 재발급을 반복하지 않고 로그인 상태를 해제한다', async () => {
  const current = client(async () => {}, { acceptRefreshed: false })
  await assert.rejects(current.apiClient.get('/auth/me'), /Expired/)
  assert.deepEqual(current.counts(), [1, 1])
  assert.equal(current.sent.length, 2)
})
