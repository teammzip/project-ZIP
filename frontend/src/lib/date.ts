/* 날짜·금액 표시용 작은 함수들. 날짜 문자열은 모두 'YYYY-MM-DD', 달은 'YYYY-MM' 형식입니다. */

export const DOW = ['일', '월', '화', '수', '목', '금', '토']

export const pad = (n: number) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD' (내 컴퓨터 시간대 기준) */
export const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayStr = () => fmt(new Date())

export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

/** 오늘에서 n일 뒤(음수면 전) 날짜 */
export function dayOffset(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return fmt(d)
}

/** N달 전 달의 day일 (31일이 없는 달이면 다음 달로 넘어가지 않게 마지막 날로 맞춤) */
export function dateOfMonthsAgo(monthsAgo: number, day: number) {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getDate()
  return fmt(new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.min(day, last)))
}

/** 오늘부터 그 날짜까지 며칠 남았는지 (지났으면 음수) */
export function dayDiff(dateStr: string) {
  return Math.round((new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${todayStr()}T00:00:00`).getTime()) / 86400000)
}

/** 'MM-DD' 부분을 '10월 18일' 로 */
export const monthDay = (dateStr: string) => `${Number(dateStr.slice(5, 7))}월 ${Number(dateStr.slice(8, 10))}일`

/** '2026-10' → '2026년 10월 (이번 달)' */
export function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return `${y}년 ${Number(m)}월${key === monthKeyOf(new Date()) ? ' (이번 달)' : ''}`
}

export const won = (n: number) => `${Number(n).toLocaleString('ko-KR')}원`

/** 1만원 이상은 '4.8만원' 처럼 짧게 */
export const man = (n: number) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만원` : won(n))

/** 몇 분 전 · 몇 시간 전 */
export function relTime(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}
