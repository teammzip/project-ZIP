// 약관 문구를 고친 뒤: frontend/src/features/legal/content.ts(화면 약관) → db/schema.sql 기본 약관 3종 + 기존 DB 를 맞추는 마이그레이션.
// 저장소 최상위에서: node db/tools/terms-sync.cjs V5__terms_sync.sql  (실제 다음 Flyway 버전을 사용)
// 같은 버전(LEGAL_VERSION)의 본문만 맞춰요. 약관 내용(의무 · 수집 항목)이 바뀌면 새 버전을 만들지 팀이 먼저 정하세요.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const repo = path.resolve(__dirname, '../..')
const migrationName = process.argv[2]
const version = /^V([1-9]\d*)__[a-z0-9_]+\.sql$/.exec(migrationName ?? '')
if (!version || Number(version[1]) < 5) { console.log('사용법: node db/tools/terms-sync.cjs V5__terms_sync.sql'); process.exit(1) }
const migrationDir = path.join(repo, 'db/flyway')
if (fs.readdirSync(migrationDir).some(name => name.startsWith(`V${version[1]}__`))) {
  throw new Error('이미 사용 중인 Flyway 버전입니다. 다음 버전을 사용하세요.')
}
const ts = require(path.join(repo, 'frontend/node_modules/typescript'))
const src = fs.readFileSync(path.join(repo, 'frontend/src/features/legal/content.ts'), 'utf8')
const content = {}
vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: content })
const VERSION = content.LEGAL_VERSION
const docs = { SERVICE: content.TERMS, PRIVACY: content.PRIVACY, POLICY: content.POLICY }
// 화면 모양 → 서버 본문 (조항 제목 다음 줄부터 본문, 조항 사이 빈 줄) — frontend/src/features/legal/api.ts toLegalDoc 의 반대
const toText = (doc) => doc.sections.map((s) => [s.title, ...s.body].join('\n')).join('\n\n')
const q = (t) => t.replace(/\\/g, '\\\\').replace(/'/g, "''")

// 1) schema.sql 기본 약관 본문 바꾸기
const schemaPath = path.join(repo, 'db/schema.sql')
let schema = fs.readFileSync(schemaPath, 'utf8')
const nl = schema.includes('\r\n') ? '\r\n' : '\n'
schema = schema.replace(/\r\n/g, '\n')
for (const [type, doc] of Object.entries(docs)) {
  const re = new RegExp(`\\('${type}', '${VERSION}', '([^']+)', '((?:[^']|'')*)'`)
  const m = schema.match(re)
  if (!m) throw new Error(`schema.sql 에 ${type} ${VERSION} 없음`)
  if (m[1] !== doc.title) throw new Error(`${type} 제목이 다름: ${m[1]} / ${doc.title}`)
  schema = schema.replace(re, `('${type}', '${VERSION}', '${m[1]}', '${q(toText(doc))}'`)
}
fs.writeFileSync(schemaPath, schema.replace(/\n/g, nl))

// 2) 기존 DB 맞춤: 같은 버전의 본문을 화면 문구와 똑같이 (이미 같으면 그대로)
const lines = [
  `-- 적용할 DB를 선택한 후 실행. 약관 3종(${VERSION})의 본문을 화면 문구(frontend/src/features/legal/content.ts) · db/schema.sql 과 똑같이 맞춘다.`,
  '--   · (무엇이 바뀌었는지 여기에 적어 주세요)',
  '-- 약관 버전 · 회원 동의 기록은 그대로 둔다. 이미 같으면 아무것도 바뀌지 않아 다시 실행해도 된다.',
  'SET @terms_sync_safe_updates = @@SESSION.SQL_SAFE_UPDATES;',
  'SET SESSION SQL_SAFE_UPDATES = 0;',
]
for (const [type, doc] of Object.entries(docs)) {
  lines.push(`UPDATE terms_documents SET content = '${q(toText(doc))}'`, `WHERE doc_type = '${type}' AND version = '${VERSION}' AND BINARY content <> BINARY '${q(toText(doc))}';`)
}
lines.push('SET SESSION SQL_SAFE_UPDATES = @terms_sync_safe_updates;', '')
fs.writeFileSync(path.join(migrationDir, migrationName), lines.join('\n'), { flag: 'wx' })
console.log('ok', Object.keys(docs).join(','), VERSION)
