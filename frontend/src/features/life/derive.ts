/* 저장된 데이터로 계산하는 값들 (다음 월세일, 알림 목록, 지출 구성 등).
 * 여러 화면(홈·알림·캘린더·가계부·AI 대화)이 같은 계산을 쓰도록 여기에 모아 둠. */
import { useShallow } from 'zustand/react/shallow'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { dayDiff, fmt, monthDay, monthKeyOf, todayStr } from '@/lib/date'
import { TRASH, trashIco } from './data/catalog'
import { useLifeStore } from './store'
import type { Bill, CalEvent, LifeSettings, MoneyRecord, TrashEvent } from './types'
import { regionVerification, serverRegionName, serverRegionVerification } from './regionVerification'
import type { LoanCharge } from '@/features/loan/interest'
import type { ContractKind } from '@/features/onboarding/store'
import { useHousingContract } from '@/features/onboarding/useHousingContract'

export const sortEvents = <T extends { date: string; time: string }>(list: T[]) => [...list].sort((a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')))

export const isTrash = (ev: CalEvent | TrashEvent): ev is TrashEvent => 'kind' in ev && ev.kind === 'trash'

/** 요일별 쓰레기 배출을 start~end 사이 실제 날짜의 읽기 전용 일정으로 (저녁 6시) */
export function trashEventsBetween(start: string, end: string): TrashEvent[] {
  const out: TrashEvent[] = []
  const cur = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cur <= last) {
    const date = fmt(cur)
    const t = TRASH[cur.getDay()]
    if (t) out.push({ id: `trash-${date}`, date, time: '18:00', title: `${t.t} 배출`, detail: t.d, kind: 'trash' })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/** 기념일이 그 해(year)에 오는 날짜. 2월 29일 기념일은 평년엔 2월 28일 */
function annivDateIn(base: string, year: number) {
  const md = base.slice(5)
  if (md === '02-29' && new Date(year, 1, 29).getMonth() !== 1) return `${year}-02-28`
  return `${year}-${md}`
}

/** 매년 반복 기념일을 fromYear~toYear 해마다 달력용 일정으로 펼침 (원래 해는 그대로, 다른 해는 "id@해" 로).
 * 저장은 한 번만 하고 보여 줄 때만 펼침 */
export function expandAnniversaries(events: CalEvent[], fromYear: number, toYear: number): CalEvent[] {
  const extra: CalEvent[] = []
  for (const ev of events) {
    if (!ev.anniv || !ev.yearly) continue
    const first = Number(ev.date.slice(0, 4))
    for (let y = Math.max(fromYear, first); y <= toYear; y++) {
      if (y === first) continue
      extra.push({ ...ev, id: `${ev.id}@${y}`, date: annivDateIn(ev.date, y) })
    }
  }
  return extra.length ? [...events, ...extra] : events
}

/** 오늘 이후 가장 가까운 기념일들 (오늘 포함, 가까운 순). 매년 반복은 올해 · 내년 중 다가오는 날 */
export function upcomingAnniversaries(events: CalEvent[]) {
  const year = new Date().getFullYear()
  const out: Array<{ ev: CalEvent; date: string; diff: number }> = []
  for (const ev of events) {
    if (!ev.anniv) continue
    const dates = ev.yearly ? [annivDateIn(ev.date, year), annivDateIn(ev.date, year + 1)] : [ev.date]
    const date = dates.find((d) => dayDiff(d) >= 0)
    if (date) out.push({ ev, date, diff: dayDiff(date) })
  }
  return out.sort((a, b) => a.diff - b.diff)
}

/** 그 날이 속한 주 (월요일 ~ 일요일) */
export function weekRange(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start: fmt(start), end: fmt(end) }
}

const addDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return fmt(d)
}

/** 다음 월세 납부일 (이번 달 납부일이 지났으면 다음 달. 31일이 없는 달은 마지막 날) */
export function nextRentDate(rentDay: number) {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const clamp = (y: number, m: number) => new Date(y, m, Math.min(rentDay, new Date(y, m + 1, 0).getDate()))
  let c = clamp(base.getFullYear(), base.getMonth())
  if (c < base) c = clamp(base.getFullYear(), base.getMonth() + 1)
  return c
}

export const ddayText = (diff: number) => (diff === 0 ? 'D-Day' : `D-${diff}`)

/** 그 날짜가 속한 달의 월세를 냈는지 */
export const monthKeyRentPaid = (rentPaid: Record<string, boolean>, d: Date) => !!rentPaid[monthKeyOf(d)]

/** to: 누르면 열 화면 */
export type Noti = { id: string; ico: string; t: string; s: string; time: string; to?: string }

/** 알림 목록: 3일 안의 미완료 일정 · 쓰레기 배출(배출표가 있을 때). */
export function buildNotis(events: CalEvent[]): Noti[] {
  const list: Noti[] = []
  const year = new Date().getFullYear()
  const all = [...expandAnniversaries(events, year, year + 1), ...trashEventsBetween(todayStr(), addDays(3))]
  for (const ev of sortEvents(all)) {
    const diff = dayDiff(ev.date)
    if (diff < 0 || diff > 3 || (!isTrash(ev) && !ev.anniv && ev.done)) continue
    list.push({
      id: isTrash(ev) ? ev.id : `ev-${ev.id}`,
      ico: isTrash(ev) ? trashIco(ev.title) : ev.anniv ? '🎉' : '📌',
      t: ev.title,
      s: `${monthDay(ev.date)} ${ev.time || '종일'}${isTrash(ev) ? ` · ${ev.detail}` : ''}`,
      time: diff === 0 ? '오늘' : `D-${diff}`,
    })
  }
  return list
}

/** 모의 모드에서만 브라우저의 월세 설정과 납부 기록으로 알림을 계산한다. */
export function buildMockRentNoti(settings: LifeSettings, rentPaid: Record<string, boolean>, kind: ContractKind): Noti | undefined {
  if (kind !== 'monthly' || !settings.notiOn || settings.rent <= 0) return
  const due = nextRentDate(settings.rentDay)
  const date = fmt(due)
  const month = monthKeyOf(due)
  const diff = dayDiff(date)
  if (month !== monthKeyOf(new Date()) || diff < 0 || diff > 3 || monthKeyRentPaid(rentPaid, due)) return
  if ((settings.moveIn && month < settings.moveIn) || (settings.contractEnd && month > settings.contractEnd)) return
  return {
    id: `rent-${month}`, ico: '💸', t: '월세 납부 안내', s: `납부 기한 ${date} · ${settings.rent}만원`,
    time: diff === 0 ? '오늘' : `D-${diff}`, to: '/my/budget/expense',
  }
}

// 알림 목록 훅(useNotis)은 서버 알림까지 합쳐서 ./notifications.ts 에 있어요
/** 내 정보 "생활 정보" 줄 아래 작은 글씨: 동네 · 월세 · 납부일 */
export function useLifeSummary() {
  const { isJeonse, survey } = useHousingContract()
  const { region, rent, rentDay } = useLifeStore(useShallow((s) => ({ region: s.settings.region, rent: s.settings.rent, rentDay: s.settings.rentDay })))
  return isJeonse ? `${region || '동네 미설정'} · 전세${survey ? ` · 계약금 ${Number(survey.contractFee).toLocaleString('ko-KR')}원` : ''}` : `${region || '동네 미설정'} · 월세 ${rent}만원 · 매월 ${rentDay}일`
}

export const sumAmount = (list: { amount: number }[]) => list.reduce((t, r) => t + r.amount, 0)

/** back달 전(0=이번 달)의 지출을 분류별로 합침. 월세·공과금은 매달 같은 금액으로 봄. 홈 도넛과 AI "지출 요약"이 같이 씀 */
export function spendBreakdown(back: number, spends: MoneyRecord[], bills: Bill[], settings: LifeSettings, loanCharges: LoanCharge[] = [], contractKind: ContractKind = 'monthly') {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
  const key = monthKeyOf(d)
  const sums: Record<string, number> = {}
  const rent = contractKind === 'monthly' ? (Number(settings.rent) || 0) * 10000 : 0
  const billSum = sumAmount(bills)
  const interest = sumAmount(loanCharges.filter((charge) => charge.date.slice(0, 7) === key))
  if (rent) sums['월세'] = rent
  if (billSum) sums['공과금'] = billSum
  if (interest) sums['대출 이자'] = interest
  let variable = 0
  for (const s of spends) {
    if (s.date.slice(0, 7) !== key) continue
    sums[s.cat] = (sums[s.cat] ?? 0) + s.amount
    variable += s.amount
  }
  const rows = Object.entries(sums).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((t, r) => t + r[1], 0)
  return { month: d.getMonth() + 1, rows, total, fixed: rent + billSum + interest, variable }
}

/** 동네 인증 유효 기간 (일) */
export { VERIFY_DAYS } from './regionVerification'

/** 지금 우리 동네가 인증된 상태인지 + 인증한 날 · 남은 날. 우리 동네를 바꾸거나 30일이 지나면 다시 인증 */
export function useRegionVerify() {
  const userId = useAuthStore((s) => s.user?.id)
  const [now, setNow] = useState(Date.now)
  const { region, verify } = useLifeStore(useShallow((s) => ({ region: s.settings.region, verify: s.regionVerify })))
  useEffect(() => {
    const refresh = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => { window.clearTimeout(refresh); window.clearInterval(timer) }
  }, [verify?.at])
  // 서버 모드: 서버가 저장한 인증 시각(30일 지났으면 null)을 지금 동네의 인증으로 봄.
  // 서버는 regionVerifiedAt 을 늘(없으면 null) 주고, 가짜 API 모드 회원에는 이 칸이 없어서(undefined) 구분돼요
  const serverAt = useAuthStore((s) => s.user?.regionVerifiedAt)
  // 다른 기기에서 인증해 이 브라우저에 동네 이름이 없을 때 쓰는 서버의 회원 동네 ("서울특별시 중구" → "서울 중구", 날씨 · 지도와 같은 이름)
  const serverRegion = useAuthStore((s) => serverRegionName(s.user?.region))
  if (serverAt !== undefined) {
    return serverRegionVerification(region, serverRegion, serverAt, userId, now)
  }
  return regionVerification(region, verify, userId, now)
}
