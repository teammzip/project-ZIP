import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function render(query, mock = false, survey = null) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/profile/components/ProfilePersonalInfo.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (name) => {
    if (name === '@tanstack/react-query') return { useQuery: () => query }
    if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: { id: 'a', address: '로컬 주소' }, token: 'token' }) }
    if (name === '@/features/auth/api') return { isMockApi: mock }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: (selector) => selector({ survey }) }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '등록 정보 조회 실패' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  return renderToStaticMarkup(React.createElement(exports.ProfilePersonalInfo))
}
test('서버의 생년월일·주소·이메일·아이디를 표시한다', () => {
  const html = render({ data: { birth: '2000-02-29', address: '서버 주소', email: 'me@example.com', username: 'member01' } })
  for (const text of ['2000-02-29', '서버 주소', 'me@example.com', 'member01', '내 집 정보']) assert.ok(html.includes(text))
  assert.ok(!html.includes('로컬 주소'))
})
test('미등록 데이터와 조회 실패를 구분한다', () => {
  assert.ok(render({ data: {} }).includes('미등록'))
  const html = render({ isError: true, error: new Error() })
  assert.ok(html.includes('등록 정보 조회 실패'))
  assert.ok(html.includes('다시 시도'))
  assert.ok(!html.includes('미등록'))
})
test('데모 모드에서도 다른 회원의 설문 생년월일은 표시하지 않는다', () => {
  assert.ok(!render({}, true, { userId: 'b', birth: '1990-01-01' }).includes('1990-01-01'))
})
