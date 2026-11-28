import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { useLoanStore } from '@/features/loan/store'
import type { HousingLoan, LoanCharge, LoanTerms } from '@/features/loan/interest'
import type { ContractKind } from '@/features/onboarding/store'
import type { ServerBill } from './billsApi'
import type { SalaryInput } from './salaryApi'
import { useLifeStore } from './store'

type Contract = { kind: ContractKind; deposit: number; mgmtIncluded: boolean; mgmtFee: number; contractFee: number }
export type HomeInput = Contract & { homeAddress?: string | null; rent: number; rentDay: number; moveIn?: string; contractEnd?: string; loan?: LoanTerms | null }
export type SurveyLoanDraft = Partial<LoanTerms>
type HomeWrite =
  | { path: '/me/home-info'; input: HomeInput }
  | { path: '/me/home-info/loan'; input: { loan: LoanTerms | null } }
export type HousingOnboardingInput = { action: 'skip' } | {
  action: 'save'
  address?: string
  birth?: string
  salary?: Omit<SalaryInput, 'paymentDay'> & { paymentDay?: number }
  timeZone?: string
  home?: Pick<HomeInput, 'kind'> & Partial<Pick<HomeInput, 'deposit' | 'rent' | 'mgmtIncluded' | 'mgmtFee' | 'contractFee'>> & { loan?: SurveyLoanDraft }
}
type HomeResponse = {
  settings: { rent: number; rentDay: number; moveIn: string; contractEnd: string; homeAddress: string; notiOn?: boolean }
  contract: (Contract & { managementBillId: string | null }) | null
  loan: HousingLoan | null
  loanDraft: SurveyLoanDraft | null
  charges: LoanCharge[]
  managementBill: ServerBill | null
}
type HomeOwner = { id: string; sessionKey: string }
let pendingWrite: { sessionKey: string; promise: Promise<HomeResponse> } | null = null

function session(): HomeOwner {
  const { user, sessionKey } = useAuthStore.getState()
  if (!user || !sessionKey) throw new Error('로그인 후 이용해 주세요.')
  return { id: user.id, sessionKey }
}
function assertCurrent(owner: HomeOwner) {
  const current = useAuthStore.getState()
  if (current.sessionKey !== owner.sessionKey || current.user?.id !== owner.id) throw new Error('로그인 상태가 변경됐어요. 다시 불러와 주세요.')
}
function apply(data: HomeResponse, owner: HomeOwner) {
  assertCurrent(owner)
  const settings = useLifeStore.getState().settings
  useLifeStore.getState().saveSettings({ ...settings, ...(data.contract ? { rent: Number(data.settings.rent), rentDay: data.settings.rentDay,
    moveIn: data.settings.moveIn, contractEnd: data.settings.contractEnd } : {}),
    // 알림 받기는 서버 값이 기준 (다른 기기에서 바꾼 설정과 서버 알림이 같은 값을 쓰도록 복원)
    ...(typeof data.settings.notiOn === 'boolean' ? { notiOn: data.settings.notiOn } : {}),
    homeAddresses: { ...settings.homeAddresses, [owner.id]: data.settings.homeAddress } })
  if (!data.contract) return // 서버에 계약이 없으면 기존 로컬 입력은 초안으로 보존한다.
  const old = useHousingSurveyStore.getState().survey
  const prior = old?.userId === owner.id ? old : null
  const loan = data.loan?.active ? data.loan : null
  useHousingSurveyStore.getState().save({
    birth: '', income: 0, incomePeriod: 'monthly', answeredAt: new Date().toISOString(), ...prior,
    ...data.contract, userId: owner.id, address: prior?.address ?? settings.region,
    rent: Math.round(Number(data.settings.rent) * 10000), hasLoan: !!loan, loanAmount: loan?.principal ?? 0,
    loanAnnualRate: loan?.annualRate, loanPaymentDay: loan?.paymentDay, loanStartDate: loan?.startDate,
  })
  useLoanStore.setState((s) => ({ plans: [...s.plans.filter((p) => p.userId !== owner.id), ...(data.loan ? [data.loan] : [])],
    charges: [...s.charges.filter((c) => c.userId !== owner.id), ...data.charges] }))
  useLifeStore.setState((s) => ({ bills: [
    ...s.bills.filter((b) => b.id !== -1 && !(b.name === '관리비' && b.tag === '관리비')),
    ...(data.managementBill ? [{ id: -1, name: data.managementBill.name, tag: data.managementBill.tag,
      amount: data.managementBill.defaultAmount, paidMonth: data.managementBill.paid ? data.managementBill.month : null }] : []),
  ] }))
}

const homeInfoKey = (owner: HomeOwner | null) => ['home-info', owner?.id, owner?.sessionKey] as const

function homeInfoOptions(owner: HomeOwner | null) {
  return queryOptions({
    queryKey: homeInfoKey(owner),
    enabled: !!owner,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!owner) throw new Error('로그인 후 이용해 주세요.')
      assertCurrent(owner)
      if (pendingWrite?.sessionKey === owner.sessionKey) {
        try {
          return await pendingWrite.promise
        } catch {
          signal.throwIfAborted()
          assertCurrent(owner)
        }
      }
      const { data } = await apiClient.get<HomeResponse>('/me/home-info', { signal })
      signal.throwIfAborted()
      apply(data, owner)
      return data
    },
  })
}

export function useHomeInfo() {
  const user = useAuthStore((s) => s.user)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  return useQuery(homeInfoOptions(!isMockApi && user && user.role !== 'ADMIN' && sessionKey ? { id: user.id, sessionKey } : null))
}

export async function loadHomeInfo({ reset = false } = {}) {
  const owner = session()
  const options = homeInfoOptions(owner)
  if (reset) void queryClient.resetQueries({ queryKey: options.queryKey, exact: true })
  if (pendingWrite?.sessionKey === owner.sessionKey) return pendingWrite.promise
  return queryClient.fetchQuery({ ...options, staleTime: 0 })
}

export function removeHomeInfo(id: string, sessionKey: string) {
  queryClient.removeQueries({ queryKey: homeInfoKey({ id, sessionKey }), exact: true })
}

async function writeHomeInfo({ path, input }: HomeWrite) {
  const owner = session()
  if (pendingWrite?.sessionKey === owner.sessionKey) throw new Error('내 집 정보를 저장하고 있어요. 잠시 후 다시 시도해 주세요.')
  const { queryKey } = homeInfoOptions(owner)
  const promise = apiClient.put<HomeResponse>(path, input).then(async ({ data }) => {
    // 저장 전에 시작한 조회가 늦게 도착해도 저장 결과를 덮어쓰지 않는다.
    await queryClient.cancelQueries({ queryKey, exact: true })
    apply(data, owner)
    queryClient.setQueryData(queryKey, data)
    return data
  }).finally(() => { if (pendingWrite?.promise === promise) pendingWrite = null })
  pendingWrite = { sessionKey: owner.sessionKey, promise }
  return promise
}

export const saveHomeInfo = (input: HomeInput) => writeHomeInfo({ path: '/me/home-info', input })
export const saveHomeLoan = (loan: LoanTerms | null) => writeHomeInfo({ path: '/me/home-info/loan', input: { loan } })
