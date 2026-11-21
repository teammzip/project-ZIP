import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { AxiosError, isAxiosError } from 'axios'
import ts from 'typescript'

const source = readFileSync(new URL('../src/features/ai/nearbySearch.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })

const current = { lat: 35.16, lon: 129.06 }
const saved = { lat: 37.55, lon: 126.93 }
const auth = { user: { id: '1' }, token: 'test' }

function setup(getCurrentMapPosition = async () => current, requestNearby = async () => []) {
  const calls = []
  const exports = {}
  const modules = {
    axios: { isAxiosError },
    '@/features/auth/store/authStore': { useAuthStore: { getState: () => auth } },
    '@/features/life/neighborhood': { selectNeighborhood: () => ({ region: '테스트 동네', point: saved }) },
    '@/features/life/store': { useLifeStore: { getState: () => ({}) } },
    '@/features/map/location': { getCurrentMapPosition },
    '@/features/map/api': { mapApi: { nearby: (...args) => { calls.push(args); return requestNearby(...args) } } },
    '@/features/onboarding/store': { useHousingSurveyStore: { getState: () => ({}) } },
  }
  vm.runInNewContext(outputText, { exports, require: (path) => modules[path] })
  return { ...exports, calls }
}

test('상호명은 유지하고 영업시간 조건이 붙은 입력은 장소 키워드와 확인 안내로 분리한다', () => {
  const { nearbyQuery } = setup()
  assert.equal(nearbyQuery('카페 브라운').q, '카페 브라운')
  assert.equal(nearbyQuery('24시간 약국').q, '약국')
  assert.equal(nearbyQuery('24시간 약국').checkHours, true)
  assert.equal(nearbyQuery('지금 문 연 세탁방 찾아줘').q, '세탁방')
  assert.equal(nearbyQuery('근처 편의점').checkHours, false)
})

test('현재 위치와 등록 동네를 명시적으로 골라 각각의 좌표로 요청한다', async () => {
  const { searchNearby, calls } = setup()
  const { signal } = new AbortController()
  assert.equal((await searchNearby('약국', 'current', signal)).point, current)
  assert.equal((await searchNearby('약국', 'neighborhood', signal)).point, saved)
  assert.deepEqual(calls, [['약국', current, signal], ['약국', saved, signal]])
})

test('현재 위치 권한을 거부하면 임의의 좌표로 요청하지 않고 등록한 동네는 검색할 수 있다', async () => {
  const { searchNearby, calls } = setup(async () => { throw new Error('위치 권한을 허용해 주세요.') })
  const { signal } = new AbortController()
  await assert.rejects(searchNearby('약국', 'current', signal), /위치 권한/)
  assert.equal(calls.length, 0)
  await searchNearby('약국', 'neighborhood', signal)
  assert.deepEqual(calls, [['약국', saved, signal]])
})

test('위치 확인 중 화면을 닫으면 이후에 좌표를 전송하지 않는다', async () => {
  const controller = new AbortController()
  const { searchNearby, calls } = setup(async () => {
    controller.abort()
    return current
  })
  await assert.rejects(searchNearby('약국', 'current', controller.signal), { name: 'AbortError' })
  assert.equal(calls.length, 0)
})

test('연결한 백엔드에 근처 탐색 경로가 없으면 재시작 안내를 보여준다', async () => {
  const missingRoute = new AxiosError('Request failed with status code 404', 'ERR_BAD_REQUEST', undefined, undefined, { status: 404 })
  const { searchNearby } = setup(undefined, async () => { throw missingRoute })
  const { signal } = new AbortController()
  await assert.rejects(searchNearby('약국', 'current', signal), /백엔드를 최신 코드로 다시 시작/)
})
