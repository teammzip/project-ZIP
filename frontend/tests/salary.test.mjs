import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

test('월급 설정은 월·연 수입 원금과 수령일·선택 시간대를 서버에 전달한다', async () => {
  const calls = [], exports = {}
  const data = { amount: 30000001, incomePeriod: 'annual', monthlyAmount: 2500000, paymentDay: 25, startMonth: '2026-11' }
  const apiClient = {
    get: async (...args) => { calls.push(['get', ...args]); return { data } },
    put: async (...args) => { calls.push(['put', ...args]); return { data } },
  }
  const source = readFileSync(new URL('../src/features/life/salaryApi.ts', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({ apiClient }) })
  assert.equal(await exports.getSalary(), data)
  assert.equal(calls[0][1], '/me/salary')
  for (const incomePeriod of ['monthly', 'annual']) {
    const input = { amount: incomePeriod === 'monthly' ? 2500000 : 30000001, incomePeriod, paymentDay: 25 }
    await exports.saveSalary(input, 'Asia/Seoul')
    const call = calls.at(-1)
    assert.equal(call[0], 'put')
    assert.equal(call[1], '/me/salary')
    assert.equal(call[2], input)
    assert.equal(call[3].params.timeZone, 'Asia/Seoul')
  }
})
