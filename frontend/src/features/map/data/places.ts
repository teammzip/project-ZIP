/* 지도 화면의 주변 장소 (예시 데이터, 좌표도 임의 값). AI "근처 탐색" 답변도 이 목록을 씀 */
export type Place = { n: string; d: string; lat: number; lon: number }

export const PLACES: Record<string, Place[]> = {
  세탁방: [
    { n: '세탁방 A (예시)', d: '도보 약 3분 · 대형 세탁기', lat: 37.5589, lon: 126.9262 },
    { n: '세탁방 B (예시)', d: '도보 약 6분 · 24시간', lat: 37.5561, lon: 126.9231 },
    { n: '세탁방 C (예시)', d: '도보 약 9분 · 건조기', lat: 37.5578, lon: 126.9208 },
  ],
  편의점: [
    { n: '편의점 A (예시)', d: '도보 약 1분 · 24시간', lat: 37.5565, lon: 126.924 },
    { n: '편의점 B (예시)', d: '도보 약 4분', lat: 37.558, lon: 126.9255 },
    { n: '편의점 C (예시)', d: '도보 약 7분 · 24시간', lat: 37.557, lon: 126.9217 },
  ],
  약국: [
    { n: '약국 A (예시)', d: '도보 약 5분 · 평일 9~21시', lat: 37.5574, lon: 126.9268 },
    { n: '약국 B (예시)', d: '도보 약 8분 · 심야 운영', lat: 37.5553, lon: 126.925 },
  ],
  마트: [
    { n: '마트 A (예시)', d: '도보 약 10분 · 식자재', lat: 37.5594, lon: 126.9225 },
    { n: '마트 B (예시)', d: '도보 약 12분 · 생활용품', lat: 37.5548, lon: 126.9214 },
  ],
}

export const PLACE_KINDS = Object.keys(PLACES)

/** '세탁방 찾아줘' 같은 글에서 장소 종류를 찾음 (앞 두 글자로 비교) */
export const placeKindOf = (text: string) => PLACE_KINDS.find((k) => text.includes(k.slice(0, 2))) ?? null
