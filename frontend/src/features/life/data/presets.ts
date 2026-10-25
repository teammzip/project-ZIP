/* 일정 기록하기의 카테고리별 빠른 항목 (팀장님 시안 variants/app/js/data/ev-presets.js 와 같은 목록)
 * 항목 버튼을 누르고 달력에서 날짜를 누르면 그 날짜에 같은 이름의 일정이 추가돼요. 늘리려면 이 목록만 고치면 돼요.
 * color: 달력 칸 안 일정 막대 색 (직접 입력한 일정은 파랑, 쓰레기 배출은 초록) */
export const EV_PRESETS = [
  { name: '집 관리', ico: '🏠', color: '#ff8a4c', items: ['에어컨 필터 청소', '배수구 청소', '전구 교체', '소모품 재고 확인', '생필품 주문', '곰팡이 점검'] },
  { name: '청소·빨래', ico: '🧺', color: '#2ec4b6', items: ['이불 빨래', '화장실 청소', '냉장고 정리', '세탁기 통세척', '침구 교체', '쓰레기통 비우기'] },
  { name: '돈·계약', ico: '💸', color: '#f5b301', items: ['월세 이체', '공과금 납부', '관리비 확인', '보험료 납부', '계약 만료 확인', '통신비 확인'] },
  { name: '건강·생활', ico: '💊', color: '#e56b9a', items: ['병원 예약', '약 챙기기', '운동하기', '장보기', '정수기 필터 확인', '비타민 구매'] },
  { name: '연락·행정', ico: '📞', color: '#7c6cf5', items: ['집주인 통화', '주민센터 방문', '택배 반품', '전입신고', '이사 업체 연락', '수리 기사 방문'] },
]
/** 분류 안 된 일정 · 항목이 모이는 카테고리 (이름 변경 · 삭제 불가, 늘 맨 끝) */
export const UNCATEGORIZED = '미분류'

/** 처음 카테고리 목록: 위 기본 5개 + 미분류 */
export const defaultCategories = () => [...EV_PRESETS.map((p) => ({ name: p.name, ico: p.ico, items: [...p.items] })), { name: UNCATEGORIZED, ico: '📌', items: [] as string[] }]

export const EV_COLOR_DEFAULT = '#4a90e2'
export const EV_COLOR_TRASH = '#3bb273'

const CAT_COLORS = EV_PRESETS.map((p) => p.color)

/** 달력 칸 안 일정 막대 색: 카테고리 순서대로 색 (미분류 · 카테고리 없으면 기본 항목 이름으로 찾고, 그래도 없으면 파랑) */
export function evColor(title: string, trash = false, category?: string, categoryNames: string[] = []) {
  if (trash) return EV_COLOR_TRASH
  if (category && category !== UNCATEGORIZED) {
    const i = categoryNames.indexOf(category)
    if (i >= 0) return CAT_COLORS[i % CAT_COLORS.length]
  }
  return EV_PRESETS.find((p) => p.items.includes(title))?.color ?? EV_COLOR_DEFAULT
}
