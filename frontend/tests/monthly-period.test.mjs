import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const period = {}
vm.runInNewContext(compile('../src/features/life/monthlyPeriod.ts'), { exports: period, Intl, Date })

test('지역별 1일 자정에만 새달로 바뀐다', () => {
  const now = Date.parse('2026-04-30T15:00:00Z')
  assert.equal(period.monthInZone(now - 1, 'Asia/Seoul'), '2026-04')
  assert.equal(period.monthInZone(now, 'Asia/Seoul'), '2026-05')
  assert.equal(period.monthInZone(now, 'America/New_York'), '2026-04')
  assert.equal(period.monthInZone(Date.parse('2026-05-01T04:00:00Z'), 'America/New_York'), '2026-05')
  assert.equal(period.monthInZone(Date.parse('2026-12-31T15:00:00Z'), 'Asia/Seoul'), '2027-01')
})
test('현재 월 자동 추적과 과거 월 선택을 구분하고 미래 월을 막는다', () => {
  assert.equal(period.selectedMonth(null, '2026-05'), '2026-05')
  assert.equal(period.selectedMonth('2026-03', '2026-05'), '2026-03')
  assert.equal(period.selectedMonth('2026-06', '2026-05'), '2026-05')
  for (const month of ['0000-01','2026-13','2026-5','2026-06']) assert.equal(period.validSelectableMonth(month,'2026-05'), false)
  assert.equal(period.nextMinuteDelay(Date.parse('2026-04-30T14:59:59.500Z')), 500)
})
test('시간대가 DST 또는 반시간 단위여도 월을 정확히 계산한다', () => {
  assert.equal(period.monthInZone(Date.parse('2026-04-30T18:30:00Z'), 'Asia/Kolkata'), '2026-05')
  assert.ok(period.formatLocalTime('2026-05-01T00:00:00+09:00','Asia/Seoul').includes('2026'))
})

function clockHarness(initial, preferred) {
  let now = Date.parse(initial), zone = 'Asia/Seoul', state
  const timers = new Map(), events = new Map()
  let effect, cleanup, id = 0
  const exports = {}
  vm.runInNewContext(compile('../src/features/life/useLocalMonth.ts'), {
    exports, Date: { now: () => now },
    setTimeout: (fn, delay) => { timers.set(++id, { fn, due: now + delay }); return id },
    clearTimeout: (key) => timers.delete(key),
    window: { addEventListener: (name, fn) => events.set(name,fn), removeEventListener: (name) => events.delete(name) },
    document: { addEventListener: (name, fn) => events.set(name,fn), removeEventListener: (name) => events.delete(name) },
    require: (name) => {
      if (name === 'react') return { useState: (init) => { state ??= init(); return [state, (next) => { state = next(state) }] }, useEffect: (fn) => { effect = fn } }
      return { ...period, deviceTimeZone: () => zone }
    },
  })
  exports.useLocalMonth(preferred); cleanup = effect()
  return { state: () => state, timers, events, cleanup, zone: (value) => { zone = value },
    advance: (value) => { now = Date.parse(value); const due = [...timers.values()].filter((t) => t.due <= now); due.forEach((t) => t.fn()) },
    wake: (value) => { now = Date.parse(value); events.get('focus')() },
  }
}
test('열어 둔 화면은 자정에 갱신하고 복귀·시간대 변경을 다시 계산한다', () => {
  const c = clockHarness('2026-04-30T14:59:59.500Z')
  assert.equal(c.state().currentMonth, '2026-04')
  c.advance('2026-04-30T15:00:00Z')
  assert.equal(c.state().currentMonth, '2026-05')
  c.zone('America/New_York'); c.wake('2026-04-30T15:00:00Z')
  assert.equal(c.state().currentMonth, '2026-04')
  c.wake('2026-06-01T04:00:00Z')
  assert.equal(c.state().currentMonth, '2026-06')
  c.cleanup(); assert.equal(c.timers.size, 0); assert.equal(c.events.size, 0)
})
test('등록 주소 시간대가 있으면 기기 시간대 변경으로 덮어쓰지 않는다', () => {
  const c = clockHarness('2026-04-30T15:00:00Z', 'Asia/Seoul')
  c.zone('America/New_York'); c.wake('2026-04-30T15:00:00Z')
  assert.equal(c.state().timeZone, 'Asia/Seoul')
  assert.equal(c.state().currentMonth, '2026-05')
  c.cleanup()
})
