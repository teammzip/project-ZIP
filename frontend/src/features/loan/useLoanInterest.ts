import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingContract } from '@/features/onboarding/useHousingContract'
import { loadHomeInfo } from '@/features/life/homeApi'
import { isMockApi } from '@/lib/apiMode'
import { useLoanStore } from './store'

export function useLoanInterest() {
  const userId = useAuthStore((s) => s.user?.id)
  const plans = useLoanStore((s) => s.plans)
  const charges = useLoanStore((s) => s.charges)
  return { plan: plans.find((p) => p.userId === userId && p.active), charges: charges.filter((charge) => charge.userId === userId) }
}

/** 앱 실행·화면 복귀·날짜 변경 시 지나간 납부일의 기록을 보완. */
export function LoanInterestSync() {
  const { isJeonse } = useHousingContract()
  const userId = useAuthStore((s) => s.user?.id)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  const mockPlans = useLoanStore((s) => isMockApi ? s.plans : null)
  const syncDue = useLoanStore((s) => s.syncDue)
  useEffect(() => {
    if (!userId || !sessionKey || !isJeonse) return
    const sync = isMockApi ? syncDue : () => { void loadHomeInfo().catch(() => {}) }
    const refresh = () => { if (document.visibilityState === 'visible') sync() }
    if (isMockApi) sync()
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [userId, sessionKey, mockPlans, syncDue, isJeonse])
  return null
}
