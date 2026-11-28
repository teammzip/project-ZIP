import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// 생활 설정 서버 저장: 알림 받기만 바꿀 때 서버의 최신 월세 · 기간 값을 그대로 다시 보냄 (features/life/settingsApi.ts)
const source = readFileSync(new URL('../src/features/life/settingsApi.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })

function load(apiClient) {
  const exports = {}
  vm.runInNewContext(outputText, { exports, require: (name) => (name === '@/lib/apiClient' ? { apiClient } : {}) })
  return exports
}

test('GET 으로 받은 서버 값에 notiOn 만 바꿔 PUT 하고, 동네 · 주소 칸은 보내지 않는다', async () => {
  const calls = []
  const server = { rent: 55.0001, rentDay: 15, moveIn: '2026-01', contractEnd: '2027-01', notiOn: true, homeAddress: '서울 마포구', regionId: '2', regionName: '서울특별시 마포구' }
  const api = load({
    get: async (url) => { calls.push(['GET', url]); return { data: server } },
    put: async (url, body) => { calls.push(['PUT', url, body]); return { data: { ...server, notiOn: body.notiOn } } },
  })
  assert.equal(await api.saveNotiOn(false), false)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], ['GET', '/me/settings'])
  assert.equal(calls[1][1], '/me/settings')
  assert.equal(JSON.stringify(calls[1][2]), JSON.stringify({ rent: 55.0001, rentDay: 15, moveIn: '2026-01', contractEnd: '2027-01', notiOn: false }))
})

test('서버가 저장한 값을 돌려준다 (화면은 그 값으로 맞춤)', async () => {
  const api = load({
    get: async () => ({ data: { rent: 0, rentDay: 15, moveIn: '', contractEnd: '', notiOn: false } }),
    put: async () => ({ data: { rent: 0, rentDay: 15, moveIn: '', contractEnd: '', notiOn: true } }),
  })
  assert.equal(await api.saveNotiOn(true), true)
})

test('조회나 저장이 실패하면 오류를 던져서 화면이 원래 값으로 되돌린다', async () => {
  const failingGet = load({ get: async () => { throw new Error('network') }, put: async () => { throw new Error('PUT 하면 안 됨') } })
  await assert.rejects(failingGet.saveNotiOn(false), /network/)
  const failingPut = load({ get: async () => ({ data: { rent: 0, rentDay: 15, moveIn: '', contractEnd: '', notiOn: true } }), put: async () => { throw new Error('500') } })
  await assert.rejects(failingPut.saveNotiOn(false), /500/)
})
