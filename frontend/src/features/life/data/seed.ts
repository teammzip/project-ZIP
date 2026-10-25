/* 처음 열었을 때 보여줄 예시 기록.
 * "오늘" 기준으로 만들어지고, 데이터 초기화하면 다시 생깁니다. */
import { dateOfMonthsAgo, dayOffset, monthKeyOf } from '@/lib/date'
import { todayStr } from '@/lib/date'
import type { Bill, CalEvent, MoneyRecord } from '../types'

/** 예전 "할 일" 예시: 오늘 날짜의 일정으로 들어감 (팀 시안과 같은 내용) */
const TODO_SEED: Array<[number, string, boolean]> = [
  [1, '임박 재료 소진하기', false],
  [2, '욕실 청소', true],
  [3, '바닥 청소', true],
  [4, '쓰레기통 비우기', true],
  [5, '수도요금 납부', false],
  [6, '재활용 분리배출', false],
]

/** 예전에 따로 저장하던 할 일 → 오늘 날짜 일정 (기록이 사라지지 않게) */
export const todosToEvents = (todos: Array<{ id: number; text: string; done: boolean }>): CalEvent[] =>
  todos.filter((t) => t?.text?.trim()).map((t) => ({ id: `todo-${t.id}`, date: todayStr(), time: '', title: t.text, done: !!t.done }))

export const seedBills = (): Bill[] => {
  const month = monthKeyOf(new Date())
  return [
    { id: 1, name: '가스', amount: 28000, tag: '공과금', paidMonth: month },
    { id: 2, name: '전기', amount: 40000, tag: '공과금', paidMonth: month },
    { id: 3, name: '수도', amount: 32000, tag: '공과금', paidMonth: null },
  ]
}

export function seedEvents(): CalEvent[] {
  const rows: Array<[number, string, string]> = [
    [-12, '', '친구 생일 파티'], [-6, '19:00', '동아리 모임'], [-3, '10:00', '치과 진료'],
    [0, '18:00', '장보기 (냉장고 채우기)'],
    [1, '14:00', '집주인 통화'], [2, '', '택배 수령'], [4, '09:00', '보건소 예방접종'],
    [6, '18:30', '친구 저녁 약속'], [9, '', '교통카드 충전'], [13, '11:00', '이사 간 친구 집들이'],
    [18, '', '관리비 정산 확인'], [24, '20:00', '온라인 스터디'],
  ]
  return [
    ...rows.map(([off, time, title], i) => ({ id: 3000 + i, date: dayOffset(off), time, title, done: false })),
    ...todosToEvents(TODO_SEED.map(([id, text, done]) => ({ id, text, done }))),
  ]
}

// 달마다 조금씩 다르게 보이도록 쓰는 값 (1달 전, 2달 전, ... 순서)
const PART_TIME = [265000, 310000, 240000, 295000, 330000, 220000, 285000, 305000, 250000, 320000, 275000]
const EXTRA: Array<[string, number, string] | null> = [
  null, ['부수입', 42000, '중고거래'], null, ['환급·정산', 87000, '통신비 환급'], ['부수입', 60000, '번역 알바'], null,
  ['환급·정산', 35000, '카드 포인트 환급'], null, ['부수입', 50000, '중고거래'], null, ['환급·정산', 120000, '연말정산 환급'],
]

export function seedIncomes(): MoneyRecord[] {
  const list: MoneyRecord[] = [
    { id: 1, date: dayOffset(-2), cat: '아르바이트', amount: 250000, memo: '주말 카페 알바' },
    { id: 2, date: dayOffset(-5), cat: '용돈', amount: 300000, memo: '부모님 용돈' },
    { id: 3, date: dayOffset(-8), cat: '부수입', amount: 35000, memo: '중고거래' },
  ]
  let id = 2000
  for (let m = 1; m <= 11; m++) {
    list.push({ id: id++, date: dateOfMonthsAgo(m, 5), cat: '용돈', amount: 300000, memo: '부모님 용돈' })
    list.push({ id: id++, date: dateOfMonthsAgo(m, 25), cat: '아르바이트', amount: PART_TIME[m - 1], memo: m % 2 ? '주말 카페 알바' : '주말 카페 알바 (추가 근무 포함)' })
    const x = EXTRA[m - 1]
    if (x) list.push({ id: id++, date: dateOfMonthsAgo(m, 14), cat: x[0], amount: x[1], memo: x[2] })
  }
  return list
}

// [일, 분류, 금액, 메모] — 한 달치 틀. 달마다 금액에 비율을 곱해 변화를 줌
const MONTH: Array<[number, string, number, string]> = [
  [2, '식비', 12000, '점심 제육덮밥'], [3, '교통', 3200, '버스'], [4, '식비', 8500, '편의점 도시락'],
  [6, '생활용품', 15800, '세탁세제·섬유유연제'], [8, '식비', 23500, '친구와 저녁'], [9, '문화·여가', 15000, '영화'],
  [11, '식비', 38000, '마트 장보기'], [12, '교통', 4800, '지하철 충전'], [14, '건강·의료', 9000, '감기약'],
  [16, '식비', 6500, '아침 샌드위치'], [18, '생활용품', 11900, '수납박스'], [20, '문화·여가', 22000, '전시회'],
  [22, '식비', 41000, '마트 장보기'], [24, '교통', 12000, '택시'], [26, '식비', 27000, '배달 치킨'],
  [27, '기타', 10000, '경조사비'], [28, '생활용품', 8900, '욕실 청소용품'],
]
const SCALE = [1, 0.92, 1.1, 0.97, 1.05, 0.9]

export function seedSpends(): MoneyRecord[] {
  const list: MoneyRecord[] = [
    { id: 1, date: dayOffset(0), cat: '식비', amount: 6500, memo: '아침 샌드위치' },
    { id: 2, date: dayOffset(-1), cat: '생활용품', amount: 12900, memo: '세탁세제' },
    { id: 3, date: dayOffset(-2), cat: '식비', amount: 11000, memo: '점심 제육덮밥' },
    { id: 4, date: dayOffset(-4), cat: '교통', amount: 3200, memo: '버스' },
    { id: 5, date: dayOffset(-5), cat: '문화·여가', amount: 15000, memo: '영화' },
  ]
  let id = 2000
  const today = new Date().getDate()
  for (let m = 0; m <= 5; m++) {
    for (const [day, cat, amount, memo] of MONTH) {
      if (m === 0 && day >= today) continue // 이번 달은 오늘 전까지만
      list.push({ id: id++, date: dateOfMonthsAgo(m, day), cat, amount: Math.round((amount * SCALE[m]) / 100) * 100, memo })
    }
  }
  return list
}
