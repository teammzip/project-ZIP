import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* 처음 로그인 설문(우리 집 정보) 답변. 이 브라우저(localStorage)에만 저장함.
 * 서버가 생기면 user_settings 등으로 옮김 (frontend/API.md 참고). 금액은 모두 원 단위. */

export type ContractKind = 'monthly' | 'jeonse'
export type IncomePeriod = 'monthly' | 'annual'

export type HousingSurvey = {
  /** 설문을 저장한 회원. 예전 데이터에는 없을 수 있음 */
  userId?: string
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
  /** 4. 선택한 기간의 수입 (원) */
  income: number
  incomePeriod: IncomePeriod
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
    {
      name: 'zip-housing-survey',
      version: 4,
      migrate: (persisted, version) => {
        if (version !== 3) return { survey: null }
        const old = (persisted as { survey?: Omit<HousingSurvey, 'incomePeriod'> } | null)?.survey
        if (!old) return { survey: null }
        return { survey: {
          ...old,
          deposit: Math.round(old.deposit * 10000),
          rent: Math.round(old.rent * 10000),
          mgmtFee: Math.round(old.mgmtFee * 10000),
          contractFee: Math.round(old.contractFee * 10000),
          loanAmount: Math.round(old.loanAmount * 10000),
          income: Math.round(old.income * 10000),
          incomePeriod: 'monthly' as const,
        } }
      },
    },
  ),
)
