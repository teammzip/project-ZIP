/* 생활 관리(일정·가계부·알림·설정) 데이터 모양. 백엔드를 붙일 때 이 타입을 기준으로 API 를 맞추면 됩니다.
 * (DB: db/schema.sql 의 2. 마이페이지 · 생활 관리, 3. 가계부)
 * 할 일은 따로 두지 않고 일정에 "완료" 체크로 합쳤어요 (백엔드 담당 시안 PR #12 와 같은 방식) */

export type Bill = { id: number; name: string; amount: number; paid: boolean }

export type CalEvent = {
  id: number | string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, 빈 문자열이면 종일 */
  time: string
  title: string
  /** 할 일처럼 끝냈는지 */
  done?: boolean
}

/** 요일별 쓰레기 배출을 달력에 보여 주는 읽기 전용 일정 (저장하지 않고 매번 계산) */
export type TrashEvent = { id: string; date: string; time: string; title: string; detail: string; kind: 'trash' }

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
