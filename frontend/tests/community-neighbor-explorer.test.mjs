import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// 커뮤니티 "주변 동네" 탭 › 다른 동네 주변 보기: 지역 묶기와 이웃 이름 (features/community/neighborExplorer.ts)
const source = readFileSync(new URL('../src/features/community/neighborExplorer.ts', import.meta.url), 'utf8')
const exports = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports })
const { groupRegions, neighborLabels } = exports

const rows = [
  { id: '1', name: '서울특별시', parentId: null, level: 1 },
  { id: '2', name: '부산광역시', parentId: null, level: 1 },
  { id: '11', name: '중구', parentId: '1', level: 2 },
  { id: '12', name: '마포구', parentId: '1', level: 2 },
  { id: '13', name: '강남구', parentId: '1', level: 2 },
  { id: '21', name: '중구', parentId: '2', level: 2 },
  { id: '30', name: '경기도', parentId: null, level: 1 },
  { id: '31', name: '과천시', parentId: '30', level: 2 },
]

test('시 · 도와 시 · 군 · 구를 나눠 가나다순으로 묶는다', () => {
  const { sidos, districts } = groupRegions(rows)
  assert.equal(JSON.stringify(sidos.map((s) => s.name)), JSON.stringify(['경기도', '부산광역시', '서울특별시']))
  assert.equal(JSON.stringify(districts.get('1').map((d) => d.name)), JSON.stringify(['강남구', '마포구', '중구']))
  assert.equal(JSON.stringify(districts.get('2').map((d) => d.name)), JSON.stringify(['중구']))
})

test('다른 시 · 도의 이웃에만 시 · 도 이름을 붙여 같은 이름(중구)을 구분한다', () => {
  // 서울 강남구를 골랐을 때 이웃: 서울 마포구(같은 시 · 도), 경기 과천시(다른 시 · 도)
  assert.deepEqual(neighborLabels([{ id: '12', name: '마포구' }, { id: '31', name: '과천시' }], rows, '1'), ['마포구', '경기도 과천시'])
  // 부산 중구 기준으로 서울 중구가 이웃이면 서울특별시를 붙임
  assert.deepEqual(neighborLabels([{ id: '11', name: '중구' }], rows, '2'), ['서울특별시 중구'])
  // 지역 목록에 없는 이웃은 이름만
  assert.deepEqual(neighborLabels([{ id: '999', name: '어딘가' }], rows, '1'), ['어딘가'])
})
