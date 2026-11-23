import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import { isCancelledError, QueryClient, QueryObserver, queryOptions } from '@tanstack/react-query'
import ts from 'typescript'

function setup() {
  let auth = { user: { id: 'a' }, sessionKey: 'token-a' }
  const life = { settings: { region: '동네', rent: 10, rentDay: 15, moveIn: '', contractEnd: '', notiOn: true }, bills: [] }
  const survey = { survey: { userId: 'a', birth: '1990-01-01' } }
  const loans = { plans: [], charges: [] }
  const response = { settings: { rent: 55.0003, rentDay: 20, moveIn: '2026-01', contractEnd: '2028-01', homeAddress: '서버 집 주소' },
    contract: { kind: 'monthly', deposit: 10000000, mgmtIncluded: false, mgmtFee: 50000, contractFee: 0 },
    loan: null, charges: [], managementBill: { id: '9007199254740993', name: '관리비', defaultAmount: 50000, tag: '관리비', paid: true, month: '2026-11' } }
  life.saveSettings = (value) => { life.settings = value }
  survey.save = (value) => { survey.survey = value }
  const calls = []
  const client = {
    get: async (path) => { calls.push(path); return { data: response } },
    put: async (path, input) => { calls.push({ path, input }); return { data: response } },
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  const observe = (options) => new QueryObserver(queryClient, options)
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/life/homeApi.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (name) => {
    if (name === '@tanstack/react-query') return { queryOptions, useQuery: observe }
    if (name === '@/lib/apiClient') return { apiClient: client }
    if (name === '@/lib/apiMode') return { isMockApi: false }
    if (name === '@/lib/queryClient') return { queryClient }
    if (name === '@/features/auth/store/authStore') return { useAuthStore: Object.assign((select) => select(auth), { getState: () => auth }) }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: { getState: () => survey } }
    if (name === '@/features/loan/store') return { useLoanStore: { setState: (update) => Object.assign(loans, update(loans)) } }
    if (name === './store') return { useLifeStore: { getState: () => life, setState: (update) => Object.assign(life, update(life)) } }
    throw new Error(name)
  } })
  const changeAccount = (id = 'b', sessionKey = 'token-b') => { auth = { user: { id }, sessionKey } }
  return { ...exports, life, survey, loans, client, response, calls, queryClient, changeAccount }
}

test('서버 계약을 설정·가계부에 반영하고 개인 생년월일은 보존한다', async () => {
  const s = setup()
  await s.loadHomeInfo()
  assert.equal(s.life.settings.homeAddresses.a, '서버 집 주소')
  assert.equal(s.survey.survey.rent, 550003)
  assert.equal(s.survey.survey.birth, '1990-01-01')
  assert.equal(s.life.bills.length, 1)
  assert.equal(s.life.bills[0].amount, 50000)
  await s.loadHomeInfo()
  assert.equal(s.life.bills.length, 1)
})
test('서버 계약이 없으면 로컬 초안을 보존하고 자동 저장하지 않는다', async () => {
  const s = setup(); s.response.contract = null
  await s.loadHomeInfo()
  assert.equal(s.life.settings.rent, 10)
  assert.equal(s.calls.length, 1)
  assert.equal(typeof s.calls[0], 'string')
})
test('저장 실패 시 기존 설정은 바뀌지 않는다', async () => {
  const s = setup(); s.client.put = async () => { throw new Error('offline') }
  const cached = await s.loadHomeInfo()
  await assert.rejects(s.saveHomeInfo({}), /offline/)
  assert.equal(s.life.settings.rent, 55.0003)
  assert.equal(s.queryClient.getQueryData(['home-info', 'a', 'token-a']), cached)
})
test('이전 회원의 늦은 응답을 다음 회원에게 적용하지 않는다', async () => {
  const s = setup(); let resolve
  s.client.get = () => new Promise((done) => { resolve = done })
  const loading = s.loadHomeInfo(); s.changeAccount(); resolve({ data: s.response })
  await assert.rejects(loading, /로그인 상태/)
  assert.equal(s.life.settings.rent, 10)
})
test('저장보다 먼저 시작한 조회가 늦게 도착해도 저장값을 덮어쓰지 않는다', async () => {
  const s = setup(); let resolve
  let signal
  s.client.get = (_path, options) => { signal = options.signal; return new Promise((done) => { resolve = done }) }
  const loading = s.loadHomeInfo()
  const cancelled = assert.rejects(loading, isCancelledError)
  await s.saveHomeInfo({})
  assert.equal(signal.aborted, true)
  resolve({ data: { ...s.response, settings: { ...s.response.settings, rent: 1 } } })
  await cancelled
  assert.equal(s.life.settings.rent, 55.0003)
  assert.equal(s.queryClient.getQueryData(['home-info', 'a', 'token-a']).settings.rent, 55.0003)
})

test('같은 로그인 세션의 동시 조회는 요청 한 번으로 합친다', async () => {
  const s = setup(); let resolve; let requests = 0
  s.client.get = () => { requests++; return new Promise((done) => { resolve = done }) }
  const first = s.loadHomeInfo(), second = s.loadHomeInfo()
  assert.equal(requests, 1)
  resolve({ data: s.response })
  await Promise.all([first, second])
  assert.equal(s.life.bills.length, 1)
  s.client.get = async () => { requests++; return { data: s.response } }
  await s.loadHomeInfo()
  assert.equal(requests, 2)
})

test('대출 전용 저장 중에는 조회가 저장 응답을 기다리고 서버 조건과 이자 기록을 반영한다', async () => {
  const s = setup()
  const terms = { principal: 120000000, annualRate: 6, paymentDay: 25, startDate: '2026-11-01' }
  let finish
  s.client.put = (path, input) => {
    assert.equal(path, '/me/home-info/loan')
    assert.equal(input.loan, terms)
    return new Promise((resolve) => { finish = resolve })
  }
  const saving = s.saveHomeLoan(terms)
  const reading = s.loadHomeInfo()
  const loan = { ...terms, id: 'loan-a', userId: 'a', active: true }
  const past = { id: 'loan-a:2026-10', userId: 'a', amount: 400000 }
  const data = { ...s.response, contract: { ...s.response.contract, kind: 'jeonse' }, loan, charges: [past] }
  finish({ data })
  assert.equal(await saving, data)
  assert.equal(await reading, data)
  assert.equal(s.calls.length, 0)
  assert.equal(s.survey.survey.loanAnnualRate, 6)
  assert.equal(s.loans.plans[0], loan)
  assert.equal(s.loans.charges[0], past)
})

test('화면과 로그인 직후 조회가 요청을 공유하고 두 화면에 대출 저장값을 반영한다', async () => {
  const s = setup()
  const settings = s.useHomeInfo(), expenses = s.useHomeInfo()
  const initial = s.loadHomeInfo()
  const unsubscribeSettings = settings.subscribe(() => {})
  const unsubscribeExpenses = expenses.subscribe(() => {})
  try {
    await initial
    assert.deepEqual(s.calls, ['/me/home-info'])
    assert.equal(settings.getCurrentResult().data, expenses.getCurrentResult().data)

    const loan = { principal: 120000000, annualRate: 4, paymentDay: 25, startDate: '2026-11-01', id: 'loan-a', userId: 'a', active: true }
    s.client.put = async () => ({ data: { ...s.response, loan } })
    await s.saveHomeLoan(loan)
    assert.equal(settings.getCurrentResult().data.loan, loan)
    assert.equal(expenses.getCurrentResult().data.loan, loan)
    assert.deepEqual(s.calls, ['/me/home-info'])
  } finally {
    unsubscribeSettings()
    unsubscribeExpenses()
    s.queryClient.clear()
  }
})

test('설문 저장 뒤 이전 조회를 취소하고 공통 캐시에 서버의 대출 초안을 받는다', async () => {
  const s = setup()
  await s.loadHomeInfo()
  let oldSignal, finish
  s.client.get = (_path, { signal }) => { oldSignal = signal; return new Promise((resolve) => { finish = resolve }) }
  const beforeSave = s.loadHomeInfo().catch(() => {})
  const loanDraft = { principal: 120000000 }
  s.client.get = async () => ({ data: { ...s.response, loanDraft } })
  await s.loadHomeInfo({ reset: true })
  assert.equal(oldSignal.aborted, true)
  finish({ data: s.response })
  await beforeSave
  assert.deepEqual(s.queryClient.getQueryData(['home-info', 'a', 'token-a']).loanDraft, loanDraft)
})

test('로그아웃으로 캐시를 제거하면 다음 회원과 같은 회원의 새 세션은 이전 응답을 읽지 않는다', async () => {
  const s = setup()
  await s.loadHomeInfo()
  s.changeAccount('a', 'token-a-new')
  assert.equal(s.useHomeInfo().getCurrentResult().data, undefined)
  s.removeHomeInfo('a', 'token-a')
  assert.equal(s.queryClient.getQueryData(['home-info', 'a', 'token-a']), undefined)
  s.changeAccount()
  assert.equal(s.useHomeInfo().getCurrentResult().data, undefined)
  s.client.get = async () => ({ data: { ...s.response, settings: { ...s.response.settings, homeAddress: '다음 회원 주소' } } })
  await s.loadHomeInfo()
  assert.equal(s.useHomeInfo().getCurrentResult().data.settings.homeAddress, '다음 회원 주소')
})
