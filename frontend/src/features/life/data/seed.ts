/* 처음 시작하는 회원은 일정 · 고정 지출 · 수입 · 지출이 모두 비어 있어요. 예시 기록은 넣지 않아요.
 * 아래는 예전 버전이 따로 저장하던 "할 일"을 일정으로 옮길 때만 쓰는 도우미예요. */
import { todayStr } from '@/lib/date'
import type { CalEvent } from '../types'

/** 예전에 따로 저장하던 할 일 → 오늘 날짜 일정 (기록이 사라지지 않게) */
export const todosToEvents = (todos: Array<{ id: number; text: string; done: boolean }>): CalEvent[] =>
  todos.filter((t) => t?.text?.trim()).map((t) => ({ id: `todo-${t.id}`, date: todayStr(), time: '', title: t.text, done: !!t.done }))

/* ── 예전 버전이 처음부터 넣어 주던 예시 기록을 이미 저장한 브라우저에서 지우는 도우미 ──
 * 직접 만든 기록은 번호가 만든 시각(아주 큰 수)이라 예시 번호(1만 미만)와 겹치지 않아요.
 * 번호 + 제목/이름이 예시와 똑같은 것만 지워서, 직접 쓴 기록은 건드리지 않아요. */
const LEGACY_EVENT_TITLES = new Set([
  '친구 생일 파티', '동아리 모임', '치과 진료', '장보기 (냉장고 채우기)', '집주인 통화', '택배 수령', '보건소 예방접종',
  '친구 저녁 약속', '교통카드 충전', '이사 간 친구 집들이', '관리비 정산 확인', '온라인 스터디',
  '임박 재료 소진하기', '욕실 청소', '바닥 청소', '쓰레기통 비우기', '수도요금 납부', '재활용 분리배출',
])
const LEGACY_BILLS = new Set(['가스', '전기', '수도'])
const isLegacyId = (id: unknown) => typeof id === 'number' && id < 10_000
const isLegacyTodoId = (id: unknown) => typeof id === 'string' && /^todo-[1-6]$/.test(id)

export function stripLegacySamples<T extends { events?: CalEvent[]; bills?: Array<{ id: unknown; name: string }>; incomes?: Array<{ id: unknown }>; spends?: Array<{ id: unknown }>; settings?: Record<string, unknown> }>(s: T): T {
  if (s.events) s.events = s.events.filter((e) => !((isLegacyId(e.id) || isLegacyTodoId(e.id)) && LEGACY_EVENT_TITLES.has(e.title)))
  if (s.bills) s.bills = s.bills.filter((b) => !(isLegacyId(b.id) && LEGACY_BILLS.has(b.name)))
  if (s.incomes) s.incomes = s.incomes.filter((r) => !isLegacyId(r.id))
  if (s.spends) s.spends = s.spends.filter((r) => !isLegacyId(r.id))
  // 예전 기본 설정(월세 55만원 · 매월 15일)이 그대로면 비운 상태로
  if (s.settings && s.settings.rent === 55 && s.settings.rentDay === 15) s.settings = { ...s.settings, rent: 0, moveIn: '', contractEnd: '' }
  return s
}
