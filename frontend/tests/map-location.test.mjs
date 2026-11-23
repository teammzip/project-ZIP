import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const compile = (file) => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const code = compile('../src/features/map/location.ts')
function setup(geolocation) {
  const exports = {}
  vm.runInNewContext(code, { exports, navigator: { geolocation } })
  return exports
}

test('홈에서 전달한 좌표를 검증하며 위도·경도 0도 허용한다', () => {
  const { readMapPoint } = setup()
  assert.equal(readMapPoint({ lat: 0, lon: 0 }).lat, 0)
  assert.equal(readMapPoint({ lat: 37.5, lon: 127 }).lon, 127)
  for (const value of [null, {}, { lat: '37.5', lon: 127 }, { lat: NaN, lon: 127 }, { lat: 91, lon: 127 }, { lat: 37, lon: -181 }]) {
    assert.equal(readMapPoint(value), null)
  }
})

test('브라우저의 실제 위치를 반환하고 시간 제한과 캐시 유효 시간을 설정한다', async () => {
  const { getCurrentMapPosition } = setup({ getCurrentPosition: (success, _failure, options) => {
    assert.equal(options.timeout, 10000)
    assert.equal(options.maximumAge, 60000)
    success({ coords: { latitude: 35.16, longitude: 129.06 } })
  } })
  const point = await getCurrentMapPosition()
  assert.equal(point.lat, 35.16)
  assert.equal(point.lon, 129.06)
})

test('위치 권한 거부·시간 초과·미지원 시 예시 좌표를 현재 위치로 반환하지 않는다', async () => {
  await assert.rejects(setup().getCurrentMapPosition(), /현재 위치를 확인할 수 없어요/)
  await assert.rejects(setup({ getCurrentPosition: (_success, failure) => failure({ code: 1 }) }).getCurrentMapPosition(), /위치 권한/)
  await assert.rejects(setup({ getCurrentPosition: (_success, failure) => failure({ code: 3 }) }).getCurrentMapPosition(), /다시 시도/)
})

test('위치 API가 유효하지 않은 좌표를 반환하면 실패로 처리한다', async () => {
  await assert.rejects(setup({ getCurrentPosition: (success) => success({ coords: { latitude: Infinity, longitude: 127 } }) }).getCurrentMapPosition(), /위치 정보를 확인하지 못/)
})

test('카카오 장소 키는 숫자 ID의 원문을 보존하고 ZIP 장소와 구분한다', () => {
  const exports = {}
  vm.runInNewContext(compile('../src/features/map/kakaoPlaceId.ts'), { exports })
  const { toKakaoPlaceKey, getKakaoPlaceId, isKakaoPlace } = exports
  for (const id of ['0', '0010', '9'.repeat(50)]) {
    const key = toKakaoPlaceKey(id)
    assert.equal(key, `kakao:${id}`)
    assert.equal(getKakaoPlaceId(key), id)
    assert.equal(isKakaoPlace(id), false)
  }
  for (const id of ['', '12a', '12\n', '１２', '9'.repeat(51)]) {
    assert.equal(toKakaoPlaceKey(id), null)
    assert.equal(isKakaoPlace(`kakao:${id}`), false)
  }
})
