import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/community/${file}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, require: (name) => dependencies[name] })
  return exports
}

const { searchLocalPosts, suggestLocalPostQuery } = load('postSearch', { './types': load('types') })
const post = (id, title, body) => ({ id, title, body, ts: id })
const ids = (posts, query, sort = 'relevance') => Array.from(searchLocalPosts(posts, query, sort), ({ id }) => id)

test('붙여 쓴 검색어로 제목이나 본문에 띄어 쓴 게시글을 찾는다', () => {
  const posts = [
    post(1, '층간 소음 상담 절차', '관리실에 상담을 신청하세요.'),
    post(2, '소설 설정', '층간소음 때문에 이사하는 인물입니다.'),
    post(3, '분리 배출 안내', '유리는 분리 배출함으로 가져가세요.'),
    post(4, '배출 요일', '오늘 재활용 품목을 내놓으세요.'),
  ]
  assert.deepEqual(ids(posts, '층간소음'), [1, 2])
  assert.deepEqual(ids(posts, '층간소음', 'latest'), [2, 1])
  assert.deepEqual(ids(posts, '분리배출'), [3])
  assert.deepEqual(ids(posts, '재활용품'), [4])
})

test('짧은 검색어, 문장부호, 제목과 본문의 경계를 보존한다', () => {
  const posts = [
    post(1, '생수 세 탁자', '행사 경품을 정리했어요.'),
    post(2, '가스 - 밸브', '서로 다른 두 상자입니다.'),
    post(3, '공동', '현관 앞을 지났습니다.'),
    post(4, '세탁 방법', '면 옷을 따로 세탁합니다.'),
  ]
  assert.deepEqual(ids(posts, '세탁'), [4])
  assert.deepEqual(ids(posts, '가스밸브'), [])
  assert.deepEqual(ids(posts, '공동현관'), [])
})

test('여러 단어 검색에서 한글 복합어의 공백을 보완하고 다른 단어는 그대로 비교한다', () => {
  const posts = [
    post(1, '공동현관 QR-2 안내', '버튼 안내입니다.'),
    post(2, '공동 현관 출입 안내', 'QR-2 버튼을 누릅니다.'),
    post(3, '공동 현관 QR2 안내', '다른 버튼입니다.'),
    post(4, '공동-현관 QR-2 안내', '문장부호가 들어갑니다.'),
    post(5, '공동', '현관 QR-2 안내입니다.'),
    post(6, '공동 현관 QR-2', '문서는 없습니다.'),
    post(7, '전기 자전거용 충전 보관함', '주차장 입구 옆입니다.'),
    post(8, '장비 목록에 있는 세 탁자', '의자는 없습니다.'),
  ]
  assert.deepEqual(ids(posts, '공동현관 QR-2 안내'), [1, 2])
  assert.deepEqual(ids(posts, '공동현관 QR-2 안내', 'latest'), [2, 1])
  assert.deepEqual(ids(posts, '전기자전거 충전보관함'), [7])
  assert.deepEqual(ids(posts, '세탁 장비'), [])
})

test('같은 범위에 실제 결과가 있고 한 자모 차이 후보가 하나일 때만 오타 검색어를 제안한다', () => {
  const posts = [post(1, '방충망 교체 안내', '기존 망의 길이를 먼저 확인하세요.'), post(2, '동네 24시간 약국', '연중 운영합니다.')]
  assert.equal(suggestLocalPostQuery(posts, '방충망 교채'), '방충망 교체')
  assert.equal(suggestLocalPostQuery(posts, '24시간 약굳'), '24시간 약국')
  assert.equal(suggestLocalPostQuery([], '방충망 교채'), undefined)
  assert.equal(suggestLocalPostQuery(posts, '방충망 교재'), undefined)
  assert.equal(suggestLocalPostQuery(posts, '교채'), undefined)
  assert.equal(suggestLocalPostQuery(posts, '개포동'), undefined)
  const both = [post(3, '동네 세탁방', '운영 시간을 알려드려요.'), post(4, '세탁망 고르는 법', '옷 크기를 기준으로 골라요.')]
  assert.equal(suggestLocalPostQuery(both, '세탁빵'), undefined)
})
