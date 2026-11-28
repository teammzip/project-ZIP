import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// 공지 팝업은 홈(/)에서만 뜸: 지도 · 커뮤니티 등에서 새로고침해도 뜨지 않음 (features/notice/NoticePopup.tsx)
const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/features/notice/NoticePopup.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function render(pathname, { uid = 'member-a', hidden = {} } = {}) {
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    Date,
    require: (name) => {
      if (name === 'react-router-dom') return { useLocation: () => ({ pathname }) }
      if (name === '@/components/ui') return { Modal: ({ children }) => React.createElement('div', { 'data-modal': '' }, children) }
      if (name === '@/features/auth') return { useAuthStore: (selector) => selector({ user: uid ? { id: uid } : null }) }
      if (name === '@/lib/cx') return { cx: (...v) => v.filter(Boolean).join(' ') }
      if (name === './api') return { usePopupNotices: () => [{ id: 'n1', title: '점검 안내', body: '내일 점검', createdAt: '2026-11-28' }] }
      if (name === './NoticePopupCard') return { NoticePopupCard: ({ items }) => React.createElement('p', null, items.map((i) => i.title).join(',')) }
      if (name === './popupStorage') return { REOPEN: 'zip:reopen', WEEK: 7 * 864e5, hideKey: (u) => `k-${u}`, readHidden: () => hidden }
      if (name.endsWith('.css')) return { default: {} }
      return require(name)
    },
  })
  return renderToStaticMarkup(React.createElement(exports.NoticePopup))
}

test('홈에서는 공지 팝업을 보여 준다', () => {
  assert.match(render('/'), /점검 안내/)
})

test('지도 · 커뮤니티 · 내 정보 등 다른 화면에서는 보여 주지 않는다', () => {
  for (const path of ['/map', '/community', '/my/settings', '/ai', '/life/calendar']) assert.equal(render(path), '', path)
})

test('홈이어도 로그인 전이거나 일주일 안 보기 한 공지는 보여 주지 않는다', () => {
  assert.equal(render('/', { uid: null }), '')
  assert.equal(render('/', { hidden: { n1: Date.now() + 864e5 } }), '')
})
