/* 생활 관리(할 일·일정·가계부·알림·설정) 데이터 모양. 백엔드를 붙일 때 이 타입을 기준으로 API 를 맞추면 됩니다.
 * (DB 구조 그림: db/erd-2-life-management.png) */

export type Todo = { id: number; text: string; done: boolean }

export type Bill = { id: number; name: string; amount: number; paid: boolean }

export type CalEvent = {
  id: number
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, 빈 문자열이면 종일 */
  time: string
  title: string
}

/** 수입·기타 지출 기록 (모양이 같음) */
export type MoneyRecord = { id: number; date: string; cat: string; amount: number; memo: string }

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
