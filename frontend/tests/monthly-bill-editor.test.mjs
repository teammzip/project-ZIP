import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function editor(bill, fail = false, confirm = true) {
  const values = [], calls = [], exports = {}
  let index = 0, invalidations = 0
  const save = (kind) => async (...args) => {
    calls.push({ kind, args })
    if (fail) throw new Error('저장 실패')
    return { name: '전기', amount: 45000, dueDate: '2026-12-05' }
  }
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/life/components/MonthlyBillEditor.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, window: { confirm: () => confirm }, require: (name) => {
    if (name === 'react') return { useEffect() {}, useRef(initial) { const slot = index++; if (!(slot in values)) values[slot] = { current: initial }; return values[slot] }, useState(initial) {
      const slot = index++
      if (!(slot in values)) values[slot] = typeof initial === 'function' ? initial() : initial
      return [values[slot], (value) => { values[slot] = value }]
    } }
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async () => { invalidations++ } }) }
    if (name === '../billsApi') return { registerMonthlyBill: save('create'), updateMonthlyBill: save('update'), deleteMonthlyBill: save('delete') }
    if (name === '../ledgerCategories') return { useLedgerCategories: () => [{ name: '공과금' }, { name: '통신' }] }
    if (name === './LedgerCategoryDialog') return { LedgerCategoryDialog: () => null }
    if (name === '@/lib/apiClient') return { getErrorMessage: (error) => error.message }
    if (name === '@/lib/cx') return { cx: (...values) => values.filter(Boolean).join(' ') }
    if (name === '@/components/ui') return { Button: 'button', AmountInput: 'amount-input' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  const nodes = () => {
    index = 0
    const out = []
    const walk = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); out.push(node); walk(node.props?.children) }
    walk(exports.MonthlyBillEditor({ month: '2026-11', timeZone: 'America/New_York', bill }))
    return out
  }
  return { nodes, calls, invalidations: () => invalidations,
    button: (text) => nodes().find((n) => n.type === 'button' && n.props.children === text),
    input: (type) => nodes().find((n) => n.type === 'input' && n.props.type === type),
    submit: async () => { nodes().find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); await new Promise(setImmediate) },
  }
}
const bill = { id: '42', name: '전기', tag: '공과금', amount: 40000, dueDate: '2026-11-30', snapshot: true }
test('등록된 월 기록만 수정하고 선택 월·시간대로 저장한 뒤 목록을 갱신한다', async () => {
  const ui = editor(bill)
  assert.ok(ui.button('수정'))
  ui.button('수정').props.onClick()
  ui.input('number').props.onChange({ target: { value: '45000' } })
  ui.input('date').props.onChange({ target: { value: '2026-12-05' } })
  await ui.submit()
  assert.equal(ui.calls[0].kind, 'update')
  assert.deepEqual(Array.from(ui.calls[0].args.slice(0, 3)), ['42', '2026-11', 'America/New_York'])
  assert.equal(ui.calls[0].args[3].amount, 45000)
  assert.equal(ui.calls[0].args[3].dueDate, '2026-12-05')
  assert.equal(ui.invalidations(), 1)
})
test('미등록 예정액에는 수정 대신 등록을 표시하고 기존 항목명으로 등록한다', async () => {
  const ui = editor({ ...bill, snapshot: false, dueDate: null })
  assert.equal(ui.button('수정'), undefined)
  ui.button('등록').props.onClick()
  ui.input('date').props.onChange({ target: { value: '2026-12-05' } })
  await ui.submit()
  assert.equal(ui.calls[0].kind, 'create')
  assert.equal(ui.calls[0].args[2].name, '전기')
})
test('취소·유효하지 않은 금액은 전송하지 않고 실패 시 입력을 보존한다', async () => {
  const ui = editor(bill, true)
  ui.button('수정').props.onClick()
  ui.button('취소').props.onClick()
  assert.equal(ui.calls.length, 0)
  ui.button('수정').props.onClick()
  ui.input('number').props.onChange({ target: { value: '-1' } })
  await ui.submit()
  assert.equal(ui.calls.length, 0)
  ui.input('number').props.onChange({ target: { value: '45000' } })
  await ui.submit()
  assert.equal(ui.input('number').props.value, '45000')
  assert.ok(ui.nodes().some((n) => n.props?.role === 'alert' && n.props.children === '저장 실패'))
  assert.equal(ui.invalidations(), 0)
})
test('고정 지출 입력 폼은 바로 보이고 사진 업로드를 제공하지 않는다', async () => {
  const ui = editor()
  assert.ok(ui.button('기록하기'))
  assert.ok(ui.button('＋ 카테고리 추가'))
  assert.equal(ui.nodes().some((node) => node.type === 'input' && node.props.type === 'file'), false)
  ui.nodes().find((node) => node.type === 'amount-input').props.onValueChange('42000')
  assert.equal(ui.nodes().some((node) => node.props?.children === '항목 이름'), false)
  ui.input('date').props.onChange({ target: { value: '2026-12-05' } })
  await ui.submit()
  assert.equal(ui.calls[0].kind, 'create')
  assert.equal(ui.calls[0].args[2].amount, 42000)
  assert.equal('name' in ui.calls[0].args[2], false)
  assert.equal(ui.invalidations(), 1)
})
test('신규 등록은 해당 시간대의 오늘 이전 납부 기한을 전송하지 않는다', async () => {
  const ui = editor()
  const today = ui.input('date').props.min
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/)
  const yesterday = new Date(`${today}T00:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  ui.nodes().find((node) => node.type === 'amount-input').props.onValueChange('42000')
  ui.input('date').props.onChange({ target: { value: yesterday.toISOString().slice(0, 10) } })
  await ui.submit()
  assert.equal(ui.calls.length, 0)
  assert.ok(ui.nodes().some((node) => node.props?.role === 'alert' && node.props.children.includes('오늘 이후')))
  ui.input('date').props.onChange({ target: { value: today } })
  await ui.submit()
  assert.equal(ui.calls.length, 1)
})


test('등록된 월 기록 삭제는 확인 후 선택 월과 시간대로 요청하고 갱신한다', async () => {
  const ui = editor(bill)
  ui.button('삭제').props.onClick()
  await new Promise(setImmediate)
  assert.equal(ui.calls[0].kind, 'delete')
  assert.deepEqual(Array.from(ui.calls[0].args), ['42', '2026-11', 'America/New_York'])
  assert.equal(ui.invalidations(), 1)
})
test('삭제 취소 및 미등록 기록은 삭제 요청을 보내지 않는다', () => {
  const ui = editor(bill, false, false)
  ui.button('삭제').props.onClick()
  assert.equal(ui.calls.length, 0)
  assert.equal(editor({ ...bill, snapshot: false }).button('삭제'), undefined)
})
test('삭제 실패는 오류를 표시하고 목록을 유지한다', async () => {
  const ui = editor(bill, true)
  ui.button('삭제').props.onClick()
  await new Promise(setImmediate)
  assert.equal(ui.invalidations(), 0)
  assert.ok(ui.nodes().some(n => n.props?.role === 'alert'))
  assert.ok(ui.button('삭제'))
})

test('삭제 연속 클릭은 요청을 한 번만 보낸다', async () => {
  const ui = editor(bill)
  const click = ui.button('삭제').props.onClick
  click(); click()
  await new Promise(setImmediate)
  assert.equal(ui.calls.length, 1)
})
