import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function setup(fail = false) {
  const exports = {}, values = [], calls = [], exchanges = []
  let index = 0, invalidations = 0
  const auth = { user: { id: 'owner' }, sessionKey: 'session' }
  const useAuthStore = (selector) => selector(auth)
  useAuthStore.getState = () => auth
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/ai/components/BillPhotoQuestion.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, FormData, require: (name) => {
    if (name === 'react') return { useState(initial) { const slot = index++; if (!(slot in values)) values[slot] = initial; return [values[slot], (value) => { values[slot] = value }] } }
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ invalidateQueries: async () => { invalidations++ } }) }
    if (name === '@/features/auth') return { useAuthStore }
    if (name === '@/features/life/useBillingTimeZone') return { useBillingTimeZone: () => ({ choice: { source: 'address', timeZone: 'Asia/Seoul' }, resolving: false }) }
    if (name === '@/features/life/useLocalMonth') return { useLocalMonth: () => ({ timeZone: 'Asia/Seoul', currentMonth: '2026-11' }) }
    if (name === '@/components/ui') return { Button: 'button' }
    if (name === '../api') return { createConversation: async () => '9' }
    if (name === '@/lib/apiClient') return { getErrorMessage: (e) => e.message, apiClient: { post: async (...args) => {
      calls.push(args); if (fail) throw new Error('사진 인식 실패'); return args[0].endsWith('/decision') ? { data: { registered: args[1].register, reply: { text: args[1].register ? '등록했어요.' : '등록하지 않았어요.' } } } : { data: { draftId: 'draft-1', reply: { text: '전기 42000원, 납부 기한 2026-12-05를 가계부에 등록할까요?' } } }
    } } }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  const nodes = () => {
    index = 0
    const all = []
    const walk = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); all.push(node); walk(node.props?.children) }
    walk(exports.BillPhotoQuestion({ entryPoint: 'AI_PAGE', onExchange: (...args) => exchanges.push(args) }))
    return all
  }
  const open = () => nodes().find((n) => n.type === 'button').props.onClick()
  const pick = (file) => nodes().find((n) => n.props?.type === 'file').props.onChange({ target: { files: [file] } })
  const submit = async () => { nodes().find((n) => n.type === 'form').props.onSubmit({ preventDefault() {} }); await new Promise(setImmediate) }
  return { nodes, open, pick, submit, calls, exchanges, invalidations: () => invalidations }
}
test('고지서 인식 후 동의한 경우에만 가계부를 갱신한다', async () => {
  const ui = setup(); ui.open()
  ui.pick(new File(['bill'], 'bill.png', { type: 'image/png' }))
  await ui.submit()
  assert.equal(ui.calls[0][0], '/ai/conversations/9/bill-photo')
  assert.equal(ui.calls[0][1].get('photo').name, 'bill.png')
  assert.equal(ui.calls[0][2].params.month, '2026-11')
  assert.equal(ui.calls[0][2].params.timeZone, 'Asia/Seoul')
  assert.ok(ui.exchanges[0][1].includes('42000원'))
  assert.equal(ui.invalidations(), 0)
  assert.equal(ui.exchanges[0][2], false)
  ui.nodes().find((n) => n.type === 'button' && n.props.children === '가계부에 등록').props.onClick()
  await new Promise(setImmediate)
  assert.equal(ui.calls[1][0], '/ai/conversations/9/bill-photo/draft-1/decision')
  assert.deepEqual(JSON.parse(JSON.stringify(ui.calls[1][1])), { register: true })
  assert.equal(ui.exchanges[1][2], true)
  assert.equal(ui.invalidations(), 1)
})
test('인식 실패 시 등록 성공 답변을 만들지 않고 다시 시도할 수 있다', async () => {
  const ui = setup(true); ui.open(); ui.pick(new File(['bill'], 'bill.png', { type: 'image/png' }))
  await ui.submit()
  assert.equal(ui.exchanges.length, 0)
  assert.equal(ui.invalidations(), 0)
  assert.ok(ui.nodes().some((n) => n.props?.role === 'alert' && n.props.children === '사진 인식 실패'))
})
test('고지서가 아닌 파일은 AI 서버로 보내지 않는다', async () => {
  const ui = setup(); ui.open(); ui.pick(new File(['file'], 'file.txt', { type: 'text/plain' })); await ui.submit()
  assert.equal(ui.calls.length, 0)
})

test('등록 안 함은 취소 API를 호출하고 가계부를 갱신하지 않는다', async () => {
  const ui = setup(); ui.open(); ui.pick(new File(['bill'], 'bill.png', { type: 'image/png' })); await ui.submit()
  ui.nodes().find((n) => n.type === 'button' && n.props.children === '등록 안 함').props.onClick()
  await new Promise(setImmediate)
  assert.equal(ui.calls[1][1].register, false)
  assert.equal(ui.invalidations(), 0)
})

test('모바일 후면 카메라 촬영 입력과 저장된 사진 선택을 함께 제공한다', () => {
  const ui = setup(); ui.open()
  const inputs = ui.nodes().filter((n) => n.props?.type === 'file')
  assert.equal(inputs.length, 2)
  assert.equal(inputs[1].props.capture, 'environment')
  assert.equal(inputs[1].props.accept, 'image/jpeg,image/png')
})
