import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/features/ai/api.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
})

function askWithPost(post, { conversationId = '42', isMockApi = false } = {}) {
  const exports = {}
  const modules = {
    axios: { isAxiosError: (error) => error?.isAxiosError === true },
    '@/features/auth/api': { isMockApi },
    '@/lib/apiClient': { apiClient: { post } },
  }
  vm.runInNewContext(outputText, { exports, require: (name) => modules[name] })
  return exports.askAi(conversationId, '질문', 'qna')
}

const UNREACHABLE = 'AI 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'

const failingPost = (status, code, message) => async () => {
  throw { isAxiosError: true, response: { status, data: { code, message } } }
}

test('Gemini 사용량 소진만 사용 방법 버튼을 표시하는 응답으로 분류한다', async () => {
  const result = await askWithPost(failingPost(503, 'AI_QUOTA', 'AI 사용량을 모두 썼어요.'))
  assert.equal(result.kind, 'gemini-quota')
  assert.equal(result.text, 'AI 사용량을 모두 썼어요.')
})

test('개인 한도와 서비스 오류는 버튼 없이 해당 안내를 반환한다', async () => {
  for (const [status, code] of [[429, 'AI_LIMIT'], [502, 'AI_FAILED'], [503, 'AI_DISABLED'], [503, undefined]]) {
    const result = await askWithPost(failingPost(status, code, '잠시 뒤 다시 시도해 주세요.'))
    assert.equal(result.kind, 'unavailable')
    assert.equal(result.text, '잠시 뒤 다시 시도해 주세요.')
  }
})

test('정상 답변과 통신 실패를 구분한다', async () => {
  const answer = await askWithPost(async () => ({ data: { reply: { text: '정상 답변' } } }))
  assert.equal(answer.kind, 'reply')
  assert.equal(answer.text, '정상 답변')
})

test('서버 모드에서 서버에 닿지 못하면 데모 답변(null) 대신 연결 실패 안내를 돌려준다', async () => {
  const neverCalled = async () => { throw new Error('대화방이 없으면 요청하지 않아야 함') }
  const cases = [
    ['응답 없는 통신 실패', askWithPost(failingPost(undefined, undefined, undefined))],
    ['처리하지 않은 서버 오류(500)', askWithPost(failingPost(500, undefined, '서버 오류'))],
    ['빈 답변', askWithPost(async () => ({ data: { reply: { text: '' } } }))],
    ['대화방을 만들지 못함', askWithPost(neverCalled, { conversationId: null })],
  ]
  for (const [name, pending] of cases) {
    const result = await pending
    assert.deepEqual({ ...result }, { text: UNREACHABLE, kind: 'unavailable' }, name)
  }
})

test('모의 API 모드에서만 null 을 돌려줘서 데모 답변을 쓴다', async () => {
  const neverCalled = async () => { throw new Error('모의 모드는 서버에 요청하지 않아야 함') }
  assert.equal(await askWithPost(neverCalled, { isMockApi: true }), null)
  assert.equal(await askWithPost(neverCalled, { isMockApi: true, conversationId: null }), null)
})
