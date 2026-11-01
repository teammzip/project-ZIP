import { useAuthStore } from '@/features/auth/store/authStore'
import { useLoanStore } from '@/features/loan/store'
import { housingContractKind } from './housingContract'
import { useHousingSurveyStore } from './store'

export function getHousingContractKind() {
  const userId = useAuthStore.getState().user?.id
  return housingContractKind(useHousingSurveyStore.getState().survey, userId, useLoanStore.getState().plans.some((p) => p.userId === userId && p.active))
}

export function useHousingContract() {
  const userId = useAuthStore((s) => s.user?.id)
  const stored = useHousingSurveyStore((s) => s.survey)
  const hasActiveLoan = useLoanStore((s) => s.plans.some((p) => p.userId === userId && p.active))
  const kind = housingContractKind(stored, userId, hasActiveLoan)
  return { kind, isMonthly: kind === 'monthly', isJeonse: kind === 'jeonse', survey: userId && stored?.userId === userId ? stored : null }
}
