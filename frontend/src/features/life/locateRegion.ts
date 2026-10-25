/* 동네 인증용 위치 확인: 휴대폰 · 브라우저 위치(GPS) → 좌표를 "서울 마포구" 같은 동네 이름으로.
 * 지금은 키가 필요 없는 OpenStreetMap(Nominatim) 주소 찾기를 씀.
 * 실제 서비스에서는 카카오 로컬 API(좌표 → 행정구역)나 백엔드에서 확인하도록 바꾸면 돼요 (frontend/API.md). */

const SIDO: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
}

/** '서울특별시 마포구' → '서울 마포구' (시·도 이름을 짧게) */
export const normRegion = (region: string) =>
  region
    .trim()
    .split(/\s+/)
    .map((w) => SIDO[w] ?? w)
    .join(' ')

/** 우리 동네(예: '서울 마포구', '마포구', '경기 성남시')의 단어가 확인된 위치에 모두 들어 있으면 같은 동네 */
export function sameRegion(mine: string, found: string) {
  const words = new Set(normRegion(found).split(' '))
  const need = normRegion(mine).split(' ').filter(Boolean)
  return need.length > 0 && need.every((w) => words.has(w))
}

function getPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 기기에서는 위치를 확인할 수 없어요.'))
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) =>
        reject(new Error(err.code === err.PERMISSION_DENIED ? '위치 권한을 허용해 주세요. 브라우저 주소창 옆 설정에서 바꿀 수 있어요.' : '위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}

type NominatimAddress = Partial<Record<'province' | 'state' | 'city' | 'county' | 'borough' | 'city_district' | 'district', string>>

/** 지금 위치의 동네 이름 (예: '서울 마포구', '경기 성남시 분당구') */
export async function locateRegion() {
  const { coords } = await getPosition()
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=ko&lat=${coords.latitude}&lon=${coords.longitude}`
  let addr: NominatimAddress | undefined
  try {
    const res = await fetch(url)
    addr = (await res.json())?.address
  } catch {
    throw new Error('동네 이름을 찾지 못했어요. 인터넷 연결을 확인해 주세요.')
  }
  const parts = [addr?.province ?? addr?.state, addr?.city, addr?.county, addr?.borough ?? addr?.city_district ?? addr?.district]
  const region = normRegion([...new Set(parts.filter(Boolean))].join(' '))
  if (!region) throw new Error('이 위치의 동네 이름을 찾지 못했어요.')
  return region
}
