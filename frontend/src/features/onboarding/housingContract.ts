import type { ContractKind, HousingSurvey } from './store'

/** 다른 회원의 설문은 사용하지 않는다. 설문 없이 대출만 등록한 기존 사용자는 전세로 본다. */
export function housingContractKind(survey: HousingSurvey | null, userId: string | undefined, hasActiveLoan = false): ContractKind {
  if (userId && survey?.userId === userId) return survey.kind
  return userId && hasActiveLoan ? 'jeonse' : 'monthly'
}
