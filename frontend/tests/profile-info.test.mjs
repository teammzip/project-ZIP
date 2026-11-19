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
    if (name === '@tanstack/react-query') return { useQuery: () => query, useQueryClient: () => ({}) }
    if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: { id: 'a', nickname: '데모이름', address: '로컬 주소' }, token: 'token' }) }
    if (name === '@/features/auth/api') return { isMockApi: mock }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: (selector) => selector({ survey }) }
    if (name === '@/lib/useAge') return { useAge: (birth) => ({ age: birth ? 26 : null }) }
    if (name === '@/lib/apiClient') return { getErrorMessage: () => '등록 정보 조회 실패' }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  return renderToStaticMarkup(React.createElement(exports.ProfilePersonalInfo, {}))
}
test('개인 정보만 표시하고 주소·계약 정보는 표시하지 않는다', () => {
  const html = render({ data: { nickname: '회원이름', birth: '2000-02-29', address: '서버 주소', email: 'me@example.com', username: 'member01', rent: 55, contractEnd: '2028-11' } })
  for (const text of ['회원이름', '2000-02-29', '만 26세', 'me@example.com', 'member01', '내 개인 정보']) assert.ok(html.includes(text))
  for (const text of ['등록 주소', '서버 주소', '월세', '계약', '2028-11', '내 집 정보']) assert.ok(!html.includes(text))
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

function editor({ fail = false } = {}) {
  const values = []
  let index = 0
  const calls = []
  let info = { nickname: '기존이름', birth: '2000-02-29', email: 'me@example.com', username: 'member01' }
  const auth = { user: { id: 'a', ...info }, token: 'token', updateUser(user) { this.user = user } }
  const authStore = (selector) => selector(auth)
  authStore.getState = () => auth
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/profile/components/ProfilePersonalInfo.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (name) => {
    if (name === 'react') return { useState(initial) {
      const slot = index++
      if (!(slot in values)) values[slot] = typeof initial === 'function' ? initial() : initial
      return [values[slot], (next) => { values[slot] = typeof next === 'function' ? next(values[slot]) : next }]
    } }
    if (name === '@tanstack/react-query') return {
      useQuery: () => ({ data: info }), useQueryClient: () => ({ setQueryData: (_key, saved) => { info = saved } }),
    }
    if (name === '@/features/auth') return { useAuthStore: authStore }
    if (name === '@/features/auth/api') return { isMockApi: false }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: (selector) => selector({ survey: null }) }
    if (name === '@/lib/useAge') return { useAge: (birth) => ({ age: birth ? 26 : null }) }
    if (name === '@/lib/apiClient') return {
      getErrorMessage: () => '저장 실패',
      apiClient: { patch: async (path, body) => {
        calls.push({ path, body })
        if (fail) throw new Error('failed')
        return { data: { ...info, ...body, birth: body.birth || null } }
      } },
    }
    if (name.endsWith('.css')) return { default: {} }
    return require(name)
  } })
  function nodes() {
    index = 0
    const root = exports.ProfilePersonalInfo({})
    const out = []
    function walk(node) {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(walk)
      out.push(node)
      walk(node.props?.children)
    }
    walk(root)
    return out
  }
  const button = (text) => nodes().find((node) => node.type === 'button' && node.props.children === text)
  const input = (id) => nodes().find((node) => node.type === 'input' && node.props.id === id)
  return { nodes, button, input, calls, auth }
}

test('수정을 누르면 기존 표시 위치에 두 입력칸만 나타나고 저장·취소를 표시한다', () => {
  const ui = editor()
  assert.equal(ui.nodes().filter((node) => node.type === 'input').length, 0)
  ui.button('수정').props.onClick()
  const nodes = ui.nodes()
  assert.equal(nodes.filter((node) => node.type === 'input').length, 2)
  assert.equal(nodes.filter((node) => node.type === 'dd' && node.props.children?.type === 'input').length, 2)
  assert.equal(ui.input('personal-nickname').props.value, '기존이름')
  assert.equal(ui.input('personal-birth').props.value, '2000-02-29')
  assert.ok(ui.button('저장'))
  assert.ok(ui.button('취소'))
})

test('취소하면 API 호출 없이 기존 표시로 돌아간다', () => {
  const ui = editor()
  ui.button('수정').props.onClick()
  ui.input('personal-nickname').props.onChange({ target: { value: '변경이름' } })
  ui.button('취소').props.onClick()
  assert.equal(ui.calls.length, 0)
  assert.equal(ui.auth.user.nickname, '기존이름')
  assert.equal(ui.nodes().filter((node) => node.type === 'input').length, 0)
  ui.button('수정').props.onClick()
  assert.equal(ui.input('personal-nickname').props.value, '기존이름')
})

test('저장은 이름·생년월일만 보내고 성공 응답을 표시한다', async () => {
  const ui = editor()
  ui.button('수정').props.onClick()
  ui.input('personal-nickname').props.onChange({ target: { value: '새이름' } })
  ui.input('personal-birth').props.onChange({ target: { value: '' } })
  await ui.button('저장').props.onClick()
  assert.equal(ui.calls[0].path, '/me/profile-info')
  assert.deepEqual(Object.keys(ui.calls[0].body).sort(), ['birth', 'nickname'])
  assert.equal(ui.auth.user.nickname, '새이름')
  assert.equal(ui.auth.user.birth, null)
  assert.equal(ui.auth.user.email, 'me@example.com')
  assert.equal(ui.nodes().filter((node) => node.type === 'input').length, 0)
})

test('잘못된 날짜는 전송하지 않고 서버 저장 실패 시 입력을 보존한다', async () => {
  const ui = editor({ fail: true })
  ui.button('수정').props.onClick()
  ui.input('personal-birth').props.onChange({ target: { value: '9999-01-01' } })
  await ui.button('저장').props.onClick()
  assert.equal(ui.calls.length, 0)
  ui.input('personal-birth').props.onChange({ target: { value: '2001-01-01' } })
  await ui.button('저장').props.onClick()
  assert.equal(ui.calls.length, 1)
  assert.equal(ui.input('personal-birth').props.value, '2001-01-01')
  assert.equal(ui.auth.user.birth, '2000-02-29')
  assert.ok(ui.nodes().some((node) => node.props?.role === 'alert' && node.props.children === '저장 실패'))
})
