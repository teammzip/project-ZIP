import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'
import React from 'react'

const require = createRequire(import.meta.url)
const code = ts.transpileModule(readFileSync(new URL('../src/features/life/components/MonthlyBillActions.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
function setup(overrides = {}, fail = false) {
  const state = [], pending = { current: false }, calls = [], invalidations = []
  let index = 0
  const exports = {}
  vm.runInNewContext(code, { exports, Date, Intl, window: { confirm: () => true }, require: (name) => {
    if (name === 'react') return { useEffect: () => {}, useRef: () => pending, useState: (initial) => {
      const slot = index++; if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial
      return [state[slot], (value) => { state[slot] = value }]
    } }
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async (key) => { invalidations.push(key) } }) }
    if (name === '@/components/ui') return { Button: (props) => React.createElement('button', props) }
    if (name === '@/lib/apiClient') return { getErrorMessage: (error) => error.message }
    if (name === '../billsApi') return {
      setMonthlyBillPaid: async (...args) => { calls.push(['payment', ...args]); if (fail) throw new Error('저장 실패') },
      terminateMonthlyBill: async (...args) => { calls.push(['termination', ...args]) },
    }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  const bill = { id: '20', name: '통신', snapshot: true, paid: false, active: true, ...overrides }
  const tree = () => { index = 0; return exports.MonthlyBillActions({ bill, month: '2026-11', timeZone: 'Asia/Seoul', housing: !!overrides.housing }) }
  function find(predicate, node) {
    if (Array.isArray(node)) { for (const value of node) { const found = find(predicate, value); if (found) return found } }
    else if (node && typeof node === 'object') {
      if (predicate(node)) return node
      return find(predicate, node.props?.children)
    }
  }
  return { tree, find: (predicate) => find(predicate, tree()), calls, invalidations, bill }
}
const flush = () => new Promise((resolve) => setImmediate(resolve))

test('등록된 건만 납부하고 중복 클릭은 한 번만 요청하며 합계를 갱신한다', async () => {
  const s = setup(), button = s.find((node) => node.props?.children === '납부 완료')
  button.props.onClick(); button.props.onClick()
  await flush()
  assert.equal(s.calls.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0])), ['payment', '20', '2026-11', 'Asia/Seoul', true])
  assert.equal(s.invalidations[0].queryKey[0], 'monthly-bills')
  assert.equal(setup({ snapshot: false }).find((node) => node.props?.children === '납부 완료'), undefined)
})
test('납부 취소를 전송하고 실패 시 성공 갱신을 하지 않는다', async () => {
  const s = setup({ paid: true })
  s.find((node) => node.props?.children === '납부 취소').props.onClick()
  await flush()
  assert.equal(s.calls[0].at(-1), false)
  const failed = setup({}, true)
  failed.find((node) => node.props?.children === '납부 완료').props.onClick()
  await flush()
  assert.equal(failed.invalidations.length, 0)
  assert.equal(failed.find((node) => node.props?.role === 'alert').props.children, '저장 실패')
})
test('사용자가 입력한 해지 적용일을 전송하고 계약 비용은 해지 버튼을 제공하지 않는다', async () => {
  const s = setup()
  s.find((node) => node.props?.children === '정기 지출 해지').props.onClick()
  s.find((node) => node.type === 'input').props.onChange({ target: { value: '2099-12-01' } })
  s.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} })
  await flush()
  assert.deepEqual(JSON.parse(JSON.stringify(s.calls[0])), ['termination', '20', 'Asia/Seoul', '2099-12-01'])
  for (const value of [{ homeManaged: true }, { housing: true }, { active: false }, { terminationDate: '2099-12-01' }]) {
    assert.equal(setup(value).find((node) => node.props?.children === '정기 지출 해지'), undefined)
  }
})
