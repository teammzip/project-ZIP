import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

/* 약관 화면이 서버(GET /api/terms) 약관을 보여 줄 때, 서버 본문을 화면 모양으로 바꾼 결과가
 * 지금 화면 문구(content.ts)와 조항 제목 · 줄까지 똑같은지 (DB 기본 약관 = db/schema.sql 의 terms_documents) */

const transpile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

const content = {}
vm.runInNewContext(transpile('../src/features/legal/content.ts'), { exports: content })

const api = {}
vm.runInNewContext(transpile('../src/features/legal/api.ts'), {
  exports: api,
  require: (name) => {
    if (name === './content') return content
    if (name === '@tanstack/react-query') return { useQuery: () => ({}) }
    if (name === '@/lib/apiClient') return { apiClient: {} }
    if (name === '@/lib/apiMode') return { isMockApi: false }
    throw new Error(`unexpected import ${name}`)
  },
})

/** schema.sql 의 INSERT 에서 종류별 (버전, 제목, 본문) 꺼내기 */
function seededTerms() {
  const sql = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const out = {}
  for (const m of sql.matchAll(/\('(SERVICE|PRIVACY|POLICY)', '([^']+)', '([^']+)', '((?:[^']|'')*)', '(AGREE|CONFIRM)'/g)) {
    out[m[1]] = { version: m[2], title: m[3], content: m[4].replace(/''/g, "'") }
  }
  return out
}

const plain = (v) => JSON.parse(JSON.stringify(v))

test('DB 기본 약관 3종을 화면 모양으로 바꾸면 content.ts 와 같다', () => {
  const seeded = seededTerms()
  assert.deepEqual(Object.keys(seeded).sort(), ['POLICY', 'PRIVACY', 'SERVICE'])
  for (const [kind, local] of [['SERVICE', content.TERMS], ['PRIVACY', content.PRIVACY], ['POLICY', content.POLICY]]) {
    const doc = plain(api.toLegalDoc(seeded[kind]))
    assert.equal(doc.title, local.title, `${kind} 제목`)
    assert.equal(doc.updated, local.updated, `${kind} 시행일`)
    assert.deepEqual(doc.sections.map((s) => s.title), plain(local.sections.map((s) => s.title)), `${kind} 조항 제목`)
    assert.deepEqual(doc.sections, plain(local.sections), `${kind} 조항 본문`)
  }
})

test('빈 줄 여러 개 · 줄 끝 공백 · CRLF 도 조항으로 나눈다', () => {
  const doc = plain(api.toLegalDoc({ title: '약관', version: '2026-12-01', content: '제1조 (목적)\r\n목적 문장  \r\n\r\n\r\n제2조 (정의)\n가. 하나\n나. 둘\n' }))
  assert.equal(doc.updated, '2026. 12. 01. 시행')
  assert.deepEqual(doc.sections, [{ title: '제1조 (목적)', body: ['목적 문장'] }, { title: '제2조 (정의)', body: ['가. 하나', '나. 둘'] }])
})
