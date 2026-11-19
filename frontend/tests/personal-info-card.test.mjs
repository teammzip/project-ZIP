import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function render({ home = '', mock = false, survey = null, homeError = false } = {}) {
  const exports = {}
  const source = readFileSync(new URL('../src/features/life/components/PersonalInfoCard.tsx', import.meta.url), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: (name) => {
    if (name === '@tanstack/react-query') return { useQuery: ({ queryKey }) => queryKey[0] === 'profile-info' ? { data: { birth: '2000-01-01' } } : homeError ? { isError: true, error: new Error(), refetch() {} } : { data: { homeAddress: home } } }
    if (name === '@/features/auth') return { useAuthStore: (select) => select({ user: { id: 'a', address: '설문 동네 주소' }, token: 'token' }) }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: (select) => select({ survey }) }
    if (name === '../store') return { useLifeStore: (select) => select({ settings: { homeAddresses: { a: home } } }) }
    if (name === '@/features/profile') return { ProfilePersonalInfo: () => React.createElement('div', null, '생년월일 · 이름') }
    if (name === './SalaryInfo') return { SalaryInfo: () => React.createElement('div', null, '월급') }
    if (name === '@/lib/apiMode') return { isMockApi: mock }
    if (name === '@/lib/useAge') return { useAge: (birth) => ({ age: birth === '2000-01-01' ? 26 : null }) }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '주소 조회 실패' }
    if (name === '@/components/ui') return { Card: ({ title, children }) => React.createElement('section', null, React.createElement('h2', null, title), children), Button: ({ children, ...props }) => React.createElement('button', props, children) }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  return renderToStaticMarkup(React.createElement(exports.PersonalInfoCard, { onEditHome() {} }))
}

test('내 정보에는 개인 정보만 표시하고 수입과 동네 인증은 포함하지 않는다', () => {
  const html = render({ home: '별도로 저장한 집 주소' })
  for (const text of ['내 정보', '생년월일']) assert.ok(html.includes(text))
  for (const text of ['월급', '동네 인증', '나이 · 주소', '집 주소 수정', '별도로 저장한 집 주소', '<dt>나이</dt>']) assert.ok(!html.includes(text))
})
