// 서버 모드 동네 인증 판정: 다른 기기에서 인증해 이 브라우저에 동네 이름이 없어도 서버 인증을 인정하는지
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const transpile = (path) => ts.transpileModule(source(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const locate = {}
vm.runInNewContext(transpile('../src/features/life/locateRegion.ts'), { exports: locate })
const exports = {}
vm.runInNewContext(ts.transpileModule(source('../src/features/life/regionVerification.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, require: (name) => name === './locateRegion' ? locate : undefined })
const { serverRegionName, serverRegionVerification } = exports

const now = Date.parse('2026-11-26T05:00:00Z')
const at = '2026-11-26T04:44:28Z'

test('다른 기기에서 인증해 이 브라우저에 동네 이름이 없으면 서버의 회원 동네로 인증을 인정한다', () => {
  const result = serverRegionVerification('', '중구', at, 'member-a', now)
  assert.equal(result.verified, true)
  assert.equal(result.region, '중구')
  assert.equal(result.left, 30)
})

test('이 브라우저에 동네 이름이 있으면 그 자세한 이름을 그대로 보여 준다', () => {
  const result = serverRegionVerification('서울 중구 명동', '중구', at, 'member-a', now)
  assert.equal(result.verified, true)
  assert.equal(result.region, '서울 중구 명동')
})

test('서버 인증 시각이 없거나 동네가 없거나 로그인 전이면 인증으로 보지 않는다', () => {
  assert.equal(serverRegionVerification('', '중구', null, 'member-a', now).verified, false)
  assert.equal(serverRegionVerification('', null, at, 'member-a', now).verified, false)
  assert.equal(serverRegionVerification('', undefined, at, 'member-a', now).verified, false)
  assert.equal(serverRegionVerification('', '중구', at, undefined, now).verified, false)
})

test('30일이 지나면 다시 인증해야 한다', () => {
  const later = Date.parse('2026-12-26T04:44:29Z')
  assert.equal(serverRegionVerification('', '중구', at, 'member-a', later).verified, false)
})

test('useRegionVerify 는 서버 모드에서 로그인 응답의 회원 동네를 넘긴다', () => {
  const derive = source('../src/features/life/derive.ts')
  assert.match(derive, /serverRegionName\(s\.user\?\.region\)/)
  assert.match(derive, /serverRegionVerification\(region, serverRegion, serverAt, userId, now\)/)
})

test('서버 동네 이름은 시 · 도를 붙여 짧게 쓰고, 전체 이름이 없으면 구 이름을 쓴다', () => {
  assert.equal(serverRegionName({ name: '중구', fullName: '서울특별시 중구' }), '서울 중구')
  assert.equal(serverRegionName({ name: '중구', fullName: '부산광역시 중구' }), '부산 중구')
  assert.equal(serverRegionName({ name: '중구' }), '중구')
  assert.equal(serverRegionName(null), '')
})
