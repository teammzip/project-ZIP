/* 저장된 데이터로 계산하는 값들 (다음 월세일, 알림 목록, 지출 구성 등).
 * 여러 화면(홈·알림·캘린더·가계부·AI 대화)이 같은 계산을 쓰도록 여기에 모아 둠. */
import { useShallow } from 'zustand/react/shallow'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { dayDiff, fmt, monthDay, monthKeyOf, todayStr } from '@/lib/date'
import { TRASH, trashIco } from './data/catalog'
import { useLifeStore } from './store'
import type { Bill, CalEvent, LifeSettings, MoneyRecord, TrashEvent } from './types'
import { regionVerification } from './regionVerification'

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

export type Noti = { id: string; ico: string; t: string; s: string; time: string }

/** 알림 목록: 3일 안의 일정(끝낸 건 빼고) · 쓰레기 배출 + 월세 + 예시 알림 */
export function buildNotis(events: CalEvent[], settings: LifeSettings): Noti[] {
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
  const rdiff = dayDiff(fmt(nextRentDate(settings.rentDay)))
  list.push(
    { id: 'n2', ico: '💸', t: `월세 납부일이 ${rdiff === 0 ? '오늘이에요' : `${rdiff}일 남았어요`}`, s: `매월 ${settings.rentDay}일 · ${settings.rent}만원`, time: '1시간 전' },
    // TODO: 아래 일곱 개는 예시 알림. 냉장고·커뮤니티 기능이 서버와 연결되면 실제 알림으로 바꾸기
    { id: 'n3', ico: '🧊', t: '냉장고 재료 3개가 곧 만료돼요', s: '두부 · 방울토마토 · 우유', time: '오늘' },
    { id: 'n4', ico: '💬', t: '커뮤니티에 새 댓글이 달렸어요', s: '쓰레기 배출 시간 바뀐 건가요?', time: '어제' },
    { id: 'n5', ico: '💡', t: '이번 달 전기요금이 지난달보다 올랐어요', s: '지난달보다 약 4,200원 많아요', time: '오늘' },
    { id: 'n6', ico: '👍', t: '내 글에 좋아요가 5개 달렸어요', s: '자취 3개월차 꿀팁 모음', time: '어제' },
    { id: 'n7', ico: '📢', t: '우리 동네 공지가 올라왔어요', s: '재활용 수거 요일이 바뀌어요', time: '어제' },
    { id: 'n8', ico: '🛒', t: '이번 주 식비가 평소보다 많아요', s: '이번 주 식비 6만 8천원', time: '2일 전' },
    { id: 'n9', ico: '🧺', t: '빨래 건조대 정리할 시간이에요', s: '이번 주 빨래 알림', time: '2일 전' },
  )
  return list
}

/** 알림 목록 + 안 읽은 개수 (알림을 끄면 빨간 점은 안 보이게 showDot=false) */
export function useNotis() {
  const { events, settings, notiRead, notiDeleted } = useLifeStore(useShallow((s) => ({ events: s.events, settings: s.settings, notiRead: s.notiRead, notiDeleted: s.notiDeleted })))
  const notis = buildNotis(events, settings).filter((n) => !notiDeleted?.[n.id]) // 저장된 예전 데이터엔 notiDeleted 가 없을 수 있음
  const unread = notis.filter((n) => !notiRead[n.id]).length
  return { notis, notiRead, unread, showDot: settings.notiOn && unread > 0 }
}

/** 내 정보 "생활 정보" 줄 아래 작은 글씨: 동네 · 월세 · 납부일 */
export function useLifeSummary() {
  const { region, rent, rentDay } = useLifeStore(useShallow((s) => ({ region: s.settings.region, rent: s.settings.rent, rentDay: s.settings.rentDay })))
  return `${region || '동네 미설정'} · 월세 ${rent}만원 · 매월 ${rentDay}일`
}

export const sumAmount = (list: { amount: number }[]) => list.reduce((t, r) => t + r.amount, 0)

/** back달 전(0=이번 달)의 지출을 분류별로 합침. 월세·공과금은 매달 같은 금액으로 봄. 홈 도넛과 AI "지출 요약"이 같이 씀 */
export function spendBreakdown(back: number, spends: MoneyRecord[], bills: Bill[], settings: LifeSettings) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
  const key = monthKeyOf(d)
  const sums: Record<string, number> = {}
  const rent = (Number(settings.rent) || 0) * 10000
  const billSum = sumAmount(bills)
  if (rent) sums['월세'] = rent
  if (billSum) sums['공과금'] = billSum
  let variable = 0
  for (const s of spends) {
    if (s.date.slice(0, 7) !== key) continue
    sums[s.cat] = (sums[s.cat] ?? 0) + s.amount
    variable += s.amount
  }
  const rows = Object.entries(sums).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((t, r) => t + r[1], 0)
  return { month: d.getMonth() + 1, rows, total, fixed: rent + billSum, variable }
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
  return regionVerification(region, verify, userId, now)
}
