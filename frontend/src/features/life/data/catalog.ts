/* 고정된 목록: 쓰레기 배출 요일표, 수입·지출 분류와 색 (예시 데이터) */

export type TrashDay = { t: '일반쓰레기' | '재활용'; d: string } | null

/** 요일(일=0)별 배출 일정. 홈 카드·알림·상세 화면이 모두 이 표 하나를 씀 */
export const TRASH: TrashDay[] = [
  { t: '일반쓰레기', d: '저녁 6시 ~ 자정, 종량제 봉투 사용' },
  { t: '재활용', d: '저녁 6시 ~ 자정, 플라스틱 · 캔 · 종이 분리' },
  { t: '일반쓰레기', d: '저녁 6시 ~ 자정, 종량제 봉투 사용' },
  { t: '재활용', d: '저녁 6시 ~ 자정, 유리병 · 비닐 분리' },
  { t: '일반쓰레기', d: '저녁 6시 ~ 자정, 종량제 봉투 사용' },
  { t: '재활용', d: '저녁 6시 ~ 자정, 플라스틱 · 캔 · 종이 분리' },
  null,
]

export const trashIco = (t: string) => (t.startsWith('재활용') ? '♻️' : '🗑️')

export type Category = { name: string; color: string }

export const FIXED_INCOME_CATS: Category[] = [
  { name: '월급', color: 'var(--color-teal)' },
  { name: '이자', color: 'var(--color-primary)' },
  { name: '연금', color: 'var(--color-purple)' },
  { name: '임대 수입', color: '#f5a623' },
  { name: '기타 고정 수입', color: 'var(--color-muted)' },
]

export const OTHER_INCOME_CATS: Category[] = [
  { name: '아르바이트', color: 'var(--color-primary)' },
  { name: '용돈', color: 'var(--color-pink)' },
  { name: '부수입', color: '#f5a623' },
  { name: '환급·정산', color: 'var(--color-purple)' },
  { name: '기타', color: 'var(--color-muted)' },
]

export const INCOME_CATS = [...FIXED_INCOME_CATS, ...OTHER_INCOME_CATS]

export const SPEND_CATS: Category[] = [
  { name: '식비', color: 'var(--color-teal)' },
  { name: '생활용품', color: 'var(--color-pink)' },
  { name: '교통', color: 'var(--color-purple)' },
  { name: '건강·의료', color: 'var(--color-primary)' },
  { name: '문화·여가', color: '#f5a623' },
  { name: '기타', color: 'var(--color-muted)' },
]

/** 홈 "지출 구성" 도넛 색 (월세·공과금 포함) */
export const DONUT_COLORS: Record<string, string> = {
  월세: 'var(--color-purple)',
  공과금: 'var(--color-primary)',
  식비: 'var(--color-teal)',
  생활용품: 'var(--color-pink)',
  교통: '#5cc8ff',
  '문화·여가': '#f5a623',
  '건강·의료': '#e56b6f',
  기타: 'var(--color-muted)',
}
