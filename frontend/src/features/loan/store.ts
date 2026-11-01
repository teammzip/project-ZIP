import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from '@/features/auth/store/authStore'
import { collectLoanCharges, validateLoanTerms, type HousingLoan, type LoanCharge, type LoanTerms } from './interest'

type LoanState = {
  plans: HousingLoan[]
  charges: LoanCharge[]
  savePlan: (terms: LoanTerms) => void
  stopPlan: () => void
  syncDue: () => void
  resetCurrentUser: () => void
}

const currentUserId = () => {
  const { user, token } = useAuthStore.getState()
  return token && user?.role !== 'ADMIN' ? user?.id : undefined
}

/** 브라우저용 가계부 자동 기록. 실제 계좌 출금은 수행하지 않는다. */
export const useLoanStore = create<LoanState>()(persist((set, get) => ({
  plans: [], charges: [],
  savePlan: (input) => {
    const userId = currentUserId()
    if (!userId) throw new Error('로그인 후 대출 정보를 저장해 주세요.')
    const terms = validateLoanTerms(input)
    const { plans, charges } = get()
    // 변경 전까지 지난 납부일은 이전 금리로 확정한다.
    const settled = [...charges, ...collectLoanCharges(plans, charges, userId)]
    const existing = plans.find((plan) => plan.userId === userId && plan.active)
    // 같은 주거 대출의 자동 기록을 다시 켜도 이미 기록한 월을 중복 차감하지 않는다.
    const previous = existing ?? plans.findLast((plan) => plan.userId === userId)
    const plan: HousingLoan = { ...terms, id: previous?.id ?? crypto.randomUUID(), userId, active: true, startDate: existing?.startDate ?? terms.startDate }
    const updated = previous ? plans.map((p) => p.id === previous.id ? plan : p) : [...plans, plan]
    const newlyDue = collectLoanCharges(updated, settled, userId)
    set({ plans: updated, charges: [...settled, ...newlyDue] })
  },
  stopPlan: () => {
    const userId = currentUserId()
    if (!userId) return
    const { plans, charges } = get()
    set({ plans: plans.map((p) => p.userId === userId ? { ...p, active: false } : p), charges: [...charges, ...collectLoanCharges(plans, charges, userId)] })
  },
  syncDue: () => {
    const userId = currentUserId()
    if (!userId) return
    const { plans, charges } = get()
    const added = collectLoanCharges(plans, charges, userId)
    if (added.length) set({ charges: [...charges, ...added] })
  },
  resetCurrentUser: () => {
    const userId = currentUserId()
    if (!userId) return
    set((s) => ({ plans: s.plans.filter((p) => p.userId !== userId), charges: s.charges.filter((p) => p.userId !== userId) }))
  },
}), { name: 'zip-loan-interest', version: 1 }))
