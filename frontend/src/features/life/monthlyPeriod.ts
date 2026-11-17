/** 3순위 대안인 기기 설정의 시간대. 이 함수 자체는 GPS 권한을 요청하지 않는다. */
export function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function monthInZone(now: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(now))
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`
}
export function validSelectableMonth(month: string, currentMonth: string) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month) && month <= currentMonth
}
export function selectedMonth(selection: string | null, currentMonth: string) {
  return selection && validSelectableMonth(selection, currentMonth) ? selection : currentMonth
}
export const nextMinuteDelay = (now: number) => 60000 - (now % 60000)
export function formatLocalTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value))
}
