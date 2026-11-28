// 홈 알림 카드: 안 읽은 알림만 보여 주고, 읽은 알림은 "알림 전체 보기"에서만 보이는지
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const require = createRequire(import.meta.url)
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

/** notis · notiRead · 알림 켜짐을 넣어 HomeNotiCard 를 그린 HTML (닫은 알림 기록은 없음) */
function renderCard({ notis, notiRead, notiOn = true }) {
  const mocks = (name) => {
    if (name === '../notifications') return { useNotis: () => ({ notis, notiRead, unread: 0, showDot: false }) }
    if (name === '../store') return { useLifeStore: (selector) => selector({ settings: { notiOn } }) }
    if (name === '@/components/ui') return { Button: ({ children }) => React.createElement('button', null, children) }
    if (name === '@/lib/cx') return { cx: (...values) => values.filter(Boolean).join(' ') }
    if (name === '@/lib/date') return { todayStr: () => '2026-11-28' }
    if (name === '@/lib/storage') return { readJSON: () => null, writeJSON: () => {} }
    if (name === './HomePhotoCard.module.css') return {}
    return require(name)
  }
  const card = {}
  vm.runInNewContext(compile('../src/features/life/components/HomePhotoCard.tsx'), { exports: card, require: mocks, setTimeout, window: {} })
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(card.HomeNotiCard)))
}

const noti = (id, t) => ({ id, ico: '📌', t, s: '내용', time: '방금' })

test('읽은 알림은 빼고 안 읽은 알림만 보여 준다', () => {
  const html = renderCard({
    notis: [noti('s1', '안 읽은 일정'), noti('s2', '읽은 공지'), noti('ev-3', '안 읽은 모의 알림')],
    notiRead: { s2: true },
  })
  assert.match(html, /안 읽은 일정/)
  assert.match(html, /안 읽은 모의 알림/)
  assert.doesNotMatch(html, /읽은 공지/)
  assert.match(html, /2개/) // 머리의 개수도 안 읽은 알림 수
})

test('모두 읽었으면 "새 알림이 없어요"를 보여 준다', () => {
  const html = renderCard({ notis: [noti('s1', '읽은 알림')], notiRead: { s1: true } })
  assert.doesNotMatch(html, /읽은 알림<\/b>/)
  assert.match(html, /새 알림이 없어요/)
})

test('알림을 끄면 안 읽은 알림이 있어도 꺼져 있다고 안내한다', () => {
  const html = renderCard({ notis: [noti('s1', '안 읽은 일정')], notiRead: {}, notiOn: false })
  assert.doesNotMatch(html, /안 읽은 일정/)
  assert.match(html, /알림이 꺼져 있어요/)
})
