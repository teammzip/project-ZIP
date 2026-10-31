import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* 처음 로그인 설문(우리 집 정보) 답변. 이 브라우저(localStorage)에만 저장함.
 * 서버가 생기면 user_settings 등으로 옮김 (frontend/API.md 참고). 금액은 모두 만원 단위. */

export type ContractKind = 'monthly' | 'jeonse'

export type HousingSurvey = {
  /** 1. 생년월일 'YYYY-MM-DD' */
  birth: string
  /** 2. 간략한 주소 */
  address: string
  /** 3. 계약 유형 */
  kind: ContractKind
  /** 3-1 월세: 보증금 / 월세 / 월세에 관리비가 포함인지 / 포함이 아니면 관리비 */
  deposit: number
  rent: number
  mgmtIncluded: boolean
  /** 3-1(포함 아님) · 3-2 전세 공통: 매달 관리비 */
  mgmtFee: number
  /** 3-2 전세: 계약금 / 대출 여부 / 대출 금액 */
  contractFee: number
  hasLoan: boolean
  loanAmount: number
  /** 4. 한 달 수입 (월급 등) */
  income: number
  /** 설문을 끝낸 시각 (ISO) */
  answeredAt: string
}

type State = {
  survey: HousingSurvey | null
  save: (s: HousingSurvey) => void
}

export const useHousingSurveyStore = create<State>()(
  persist(
    (set) => ({
      survey: null,
      save: (survey) => set({ survey }),
    }),
    { name: 'zip-housing-survey', version: 3, migrate: () => ({ survey: null }) },
  ),
)
