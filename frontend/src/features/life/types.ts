/* 생활 관리(일정·가계부·알림·설정) 데이터 모양. 백엔드를 붙일 때 이 타입을 기준으로 API 를 맞추면 됩니다.
 * (DB: db/schema.sql 의 2. 마이페이지 · 생활 관리, 3. 가계부)
 * 할 일은 따로 두지 않고 일정에 "완료" 체크로 합쳤어요 (백엔드 담당 시안 PR #12 와 같은 방식) */

/** 공과금 한 항목. paidMonth = 마지막으로 납부 체크한 달('YYYY-MM'): 이번 달과 같으면 납부 완료,
 * 달이 바뀌면 저절로 미납으로 돌아감 (그래서 '새 달 시작' 버튼이 필요 없음) */
export type Bill = { id: number; name: string; amount: number; tag: string; paidMonth: string | null }

/** 고정 지출 항목에 붙일 수 있는 태그. 태그별로 합계를 따로 계산함 */
export const BILL_TAGS = ['공과금', '통신', '구독', '관리비', '기타'] as const

export type CalEvent = {
  id: number | string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, 빈 문자열이면 종일 */
  time: string
  title: string
  /** 할 일처럼 끝냈는지 */
  done?: boolean
  /** 일정 카테고리 (집 관리 · 청소·빨래 … · 미분류). 없으면 분류 안 함 */
  category?: string
}

/** 일정 카테고리: 이름 · 그림 · 기본 항목 버튼 (이름 변경 · 추가 · 삭제는 "카테고리 관리") */
export type EventCategory = { name: string; ico: string; items: string[] }

/** 사용자가 직접 만든 항목 버튼 (직접 입력한 일정이 카테고리 아래 버튼으로도 저장됨) */
export type CustomPreset = { id: string; title: string; category: string }

/** 요일별 쓰레기 배출을 달력에 보여 주는 읽기 전용 일정 (저장하지 않고 매번 계산) */
export type TrashEvent = { id: string; date: string; time: string; title: string; detail: string; kind: 'trash' }

/** 수입·기타 지출 기록 (모양이 같음) */
export type MoneyRecord = { id: number; date: string; cat: string; amount: number; memo: string }

/** 동네 인증: 어느 동네를 언제 인증했는지 (VERIFY_DAYS 일 동안 유효, 우리 동네를 바꾸면 다시 인증) */
export type RegionVerify = { region: string; at: number }

export type LifeSettings = {
  /** 우리 동네 (커뮤니티·지도 범위) 예: '서울 마포구' */
  region: string
  /** 매월 월세 납부일 (1~31) */
  rentDay: number
  /** 월세 (만원 단위) */
  rent: number
  notiOn: boolean
  /** 입주한 달 'YYYY-MM' (거주 기간 계산) */
  moveIn: string
  /** 계약 끝나는 달 'YYYY-MM' (계약 남은 기간 계산) */
  contractEnd: string
}
