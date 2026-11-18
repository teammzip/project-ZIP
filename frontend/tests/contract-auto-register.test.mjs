import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function setup(fail = false) {
  const calls = [], exports = {}
  const apiClient = {
    post: async (...args) => { calls.push(['post', ...args]); if (fail) throw new Error('자동 등록 실패') },
    get: async (...args) => { calls.push(['get', ...args]); return { data: { items: [], housingItems: [] } } },
  }
  const code = ts.transpileModule(readFileSync(new URL('../src/features/life/billsApi.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports, require: () => ({ apiClient }) })
  return { calls, api: exports }
}
test('확정 시간대로 자동 등록 후 선택 월을 조회한다', async () => {
  const { calls, api } = setup()
  await api.getMonthlyBills('2026-10', 'America/Los_Angeles')
  assert.equal(calls[0][0], 'post')
  assert.equal(calls[0][1], '/bills/monthly/auto-register')
  assert.equal(calls[0][3].params.timeZone, 'America/Los_Angeles')
  assert.equal(calls[1][0], 'get')
  assert.equal(calls[1][2].params.month, '2026-10')
})
test('자동 등록 실패 시 성공한 것처럼 조회하지 않는다', async () => {
  const { calls, api } = setup(true)
  await assert.rejects(api.getMonthlyBills('2026-11', 'Asia/Seoul'), /자동 등록 실패/)
  assert.equal(calls.length, 1)
})
