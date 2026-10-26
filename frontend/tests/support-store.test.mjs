import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/features/support/store.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const member = { id: 'member-a', nickname: '회원', role: 'USER' }
const draft = { category: '오류 신고', title: ' 날짜 선택 문의 ', content: ' 날짜를 변경하고 싶어요. ' }

function setup(saved) {
  let auth = { user: member, token: 'test-token' }
  let stored = saved
  let fail = false
  const exports = {}
  vm.runInNewContext(code, {
    exports,
    crypto: { randomUUID },
    localStorage: { setItem: (_key, value) => { if (fail) throw new Error('Quota'); stored = JSON.parse(value) } },
    require: (name) => {
      if (name === '@/features/auth') return { useAuthStore: { getState: () => auth } }
      if (name === '@/lib/storage') return { readJSON: () => stored ?? null }
      return require(name)
    },
  })
  return {
    store: exports.useSupportStore,
    visible: exports.visibleInquiries,
    login: (user) => { auth = { user, token: user ? 'test-token' : null } },
    failStorage: () => { fail = true },
    saved: () => stored,
  }
}

test('문의 저장, 새로고침 복원, 계정별 목록 및 상세 조회 대상 구분', () => {
  const ctx = setup()
  const id = ctx.store.getState().add(draft)
  const restored = setup(ctx.saved())
  const inquiries = restored.store.getState().inquiries
  assert.equal(inquiries[0].id, id)
  assert.equal(inquiries[0].title, draft.title.trim())
  assert.equal(inquiries[0].answer, null)
  assert.equal(restored.visible(inquiries, member).length, 1)
  assert.equal(restored.visible(inquiries, { ...member, id: 'member-b' }).length, 0)
  assert.equal(restored.visible(inquiries, null).length, 0)
  assert.equal(restored.visible(inquiries, { id: 'admin', role: 'ADMIN' }).length, 1)
})

test('관리자만 답변할 수 있고 답변을 작성자가 다시 조회할 수 있다', () => {
  const ctx = setup()
  const id = ctx.store.getState().add(draft)
  assert.throws(() => ctx.store.getState().reply(id, '답변'), /관리자/)
  ctx.login({ id: 'admin', role: 'ADMIN' })
  ctx.store.getState().reply(id, ' 날짜 선택을 수정했어요. ')
  assert.throws(() => ctx.store.getState().reply(id, '두 번째 답변'), /이미 답변/)
  const restored = setup(ctx.saved())
  assert.equal(restored.visible(restored.store.getState().inquiries, member)[0].answer.content, '날짜 선택을 수정했어요.')
})

test('빈 입력·비로그인·잘못된 유형을 거부하고 저장 실패 시 기록을 추가하지 않는다', () => {
  const ctx = setup()
  assert.throws(() => ctx.store.getState().add({ ...draft, title: '  ' }))
  assert.throws(() => ctx.store.getState().add({ ...draft, category: '없는 유형' }))
  assert.throws(() => ctx.store.getState().add({ ...draft, content: 'a'.repeat(3001) }))
  ctx.login(null)
  assert.throws(() => ctx.store.getState().add(draft), /로그인/)
  ctx.login(member)
  ctx.failStorage()
  assert.throws(() => ctx.store.getState().add(draft), /저장하지 못/)
  assert.equal(ctx.store.getState().inquiries.length, 0)
})
