import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const helpers = {}
vm.runInNewContext(compile('../src/lib/amountInput.ts'), { exports: helpers })
const { formatAmountInput, normalizeAmountInput, amountCaretPosition } = helpers

test('금액을 세 자리로 묶고 빈 값·0·큰 보증금을 정확히 구분한다', () => {
  for (const [raw, display] of [['', ''], ['0', '0'], ['999', '999'], ['1000', '1,000'], ['2500000', '2,500,000'], ['11999880000', '11,999,880,000']]) {
    assert.equal(formatAmountInput(raw), display)
    assert.equal(normalizeAmountInput(display), raw)
  }
})

test('쉼표가 있는 금액 붙여넣기와 기존 만원 단위 소수 금액을 보존한다', () => {
  assert.equal(normalizeAmountInput('₩ 1,250,000원'), '1250000')
  assert.equal(Number(normalizeAmountInput('1,250,000')), 1250000)
  assert.equal(formatAmountInput('1234.5678'), '1,234.5678')
  assert.equal(normalizeAmountInput('1,234.5678', 4), '1234.5678')
  assert.equal(normalizeAmountInput('55.', 4), '55.')
  assert.equal(normalizeAmountInput('.5', 4), '0.5')
  assert.equal(normalizeAmountInput('00015'), '15')
})

test('음수·지수 표기·잘못된 문자를 다른 금액으로 바꾸지 않는다', () => {
  for (const value of ['-1,000', '1e6', '12a34', '1.2.3', '1.5']) assert.equal(normalizeAmountInput(value), null)
})

function inputHarness(value, options = {}) {
  const effects = []
  const exports = {}
  const document = { activeElement: null }
  vm.runInNewContext(compile('../src/components/ui/AmountInput.tsx'), {
    exports, document,
    require: (name) => name === 'react' ? { useRef: (current) => ({ current }), useLayoutEffect: (fn) => effects.push(fn) }
      : name === '@/lib/amountInput' ? helpers : require(name),
  })
  let received = value
  const element = exports.AmountInput({ value, onValueChange: (next) => { received = next }, ...options })
  const input = {
    value: formatAmountInput(value), selectionStart: 0, selectionEnd: 0, validityMessage: '',
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end },
    setCustomValidity(message) { this.validityMessage = message },
  }
  element.props.ref.current = input
  document.activeElement = input
  effects.forEach((fn) => fn())
  return { input, props: element.props, received: () => received }
}

test('금액 중간에 숫자를 입력해도 커서 위치와 저장할 숫자를 유지한다', () => {
  const ctx = inputHarness('1234')
  ctx.input.value = '1,9234'
  ctx.input.selectionStart = 3
  ctx.props.onChange({ currentTarget: ctx.input })
  assert.equal(ctx.input.value, '19,234')
  assert.equal(ctx.received(), '19234')
  assert.equal(ctx.input.selectionStart, 2)
  assert.equal(amountCaretPosition('1,234,567', 4), 5)
})

test('쉼표 옆에서 삭제할 때 실제 숫자를 지울 수 있다', () => {
  const ctx = inputHarness('1234')
  ctx.input.setSelectionRange(1, 1)
  ctx.props.onKeyDown({ currentTarget: ctx.input, key: 'Delete' })
  assert.equal(ctx.input.selectionStart, 2)
  ctx.props.onKeyDown({ currentTarget: ctx.input, key: 'Backspace' })
  assert.equal(ctx.input.selectionStart, 1)
})

test('텍스트 입력으로 바꿔도 최대 금액 초과 검증을 유지한다', () => {
  assert.match(inputHarness('10000', { max: 9999 }).input.validityMessage, /9,999/)
  assert.equal(inputHarness('9999', { max: 9999 }).input.validityMessage, '')
  assert.equal(inputHarness('', { max: 9999 }).input.validityMessage, '')
})
