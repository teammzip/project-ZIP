import { apiClient } from '@/lib/apiClient'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { useLoanStore } from '@/features/loan/store'
import type { HousingLoan, LoanCharge, LoanTerms } from '@/features/loan/interest'
import type { ContractKind } from '@/features/onboarding/store'
import { useLifeStore } from './store'

type Contract = { kind: ContractKind; deposit: number; mgmtIncluded: boolean; mgmtFee: number; contractFee: number }
export type HomeInput = Contract & { homeAddress?: string; rent: number; rentDay: number; moveIn: string; contractEnd: string; loan: LoanTerms | null }
type HomeResponse = {
  settings: { rent: number; rentDay: number; moveIn: string; contractEnd: string; homeAddress: string }
  contract: Contract | null
  loan: HousingLoan | null
  charges: LoanCharge[]
  managementBill: { id: string; name: string; defaultAmount: number; tag: string; paid: boolean; month: string } | null
}
let revision = 0
let pendingLoad: { id: string; token: string; revision: number; promise: Promise<HomeResponse> } | null = null
let pendingWrite: { token: string; promise: Promise<HomeResponse> } | null = null

function session() {
  const { user, token } = useAuthStore.getState()
  if (!user || !token) throw new Error('로그인 후 이용해 주세요.')
  return { id: user.id, token }
}
function apply(data: HomeResponse, owner: ReturnType<typeof session>, request: number) {
  const current = useAuthStore.getState()
  if (current.token !== owner.token || current.user?.id !== owner.id || request !== revision) throw new Error('로그인 상태 또는 내 집 정보가 변경됐어요. 다시 불러와 주세요.')
  if (!data.contract) return // 서버에 계약이 없으면 기존 로컬 입력은 초안으로 보존한다. 자동 업로드하지 않는다.
  const settings = useLifeStore.getState().settings
  useLifeStore.getState().saveSettings({ ...settings, rent: Number(data.settings.rent), rentDay: data.settings.rentDay,
    moveIn: data.settings.moveIn, contractEnd: data.settings.contractEnd,
    homeAddresses: { ...settings.homeAddresses, [owner.id]: data.settings.homeAddress } })
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

export async function loadHomeInfo() {
  const owner = session()
  if (pendingWrite?.token === owner.token) return pendingWrite.promise
  if (pendingLoad?.id === owner.id && pendingLoad.token === owner.token && pendingLoad.revision === revision) return pendingLoad.promise
  const request = ++revision
  const promise = apiClient.get<HomeResponse>('/me/home-info').then(({ data }) => {
    apply(data, owner, request)
    return data
  }).finally(() => { if (pendingLoad?.revision === request) pendingLoad = null })
  pendingLoad = { ...owner, revision: request, promise }
  return promise
}
async function writeHomeInfo(path: string, input: HomeInput | { loan: LoanTerms | null }) {
  const owner = session()
  if (pendingWrite?.token === owner.token) throw new Error('내 집 정보를 저장하고 있어요. 잠시 후 다시 시도해 주세요.')
  const request = ++revision
  const promise = apiClient.put<HomeResponse>(path, input).then(({ data }) => {
    apply(data, owner, request)
    return data
  }).finally(() => { if (pendingWrite?.promise === promise) pendingWrite = null })
  pendingWrite = { token: owner.token, promise }
  return promise
}

export const saveHomeInfo = (input: HomeInput) => writeHomeInfo('/me/home-info', input)
export const saveHomeLoan = (loan: LoanTerms | null) => writeHomeInfo('/me/home-info/loan', { loan })
