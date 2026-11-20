import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function setup() {
  let auth = { user: { id: 'a' }, token: 'token-a' }
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
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/life/homeApi.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: (name) => {
    if (name === '@/lib/apiClient') return { apiClient: client }
    if (name === '@/features/auth/store/authStore') return { useAuthStore: { getState: () => auth } }
    if (name === '@/features/onboarding/store') return { useHousingSurveyStore: { getState: () => survey } }
    if (name === '@/features/loan/store') return { useLoanStore: { setState: (update) => Object.assign(loans, update(loans)) } }
    if (name === './store') return { useLifeStore: { getState: () => life, setState: (update) => Object.assign(life, update(life)) } }
    throw new Error(name)
  } })
  return { ...exports, life, survey, loans, client, response, calls, changeAccount: () => { auth = { user: { id: 'b' }, token: 'token-b' } } }
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
  await assert.rejects(s.saveHomeInfo({}), /offline/)
  assert.equal(s.life.settings.rent, 10)
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
  s.client.get = () => new Promise((done) => { resolve = done })
  const loading = s.loadHomeInfo()
  await s.saveHomeInfo({})
  resolve({ data: { ...s.response, settings: { ...s.response.settings, rent: 1 } } })
  await assert.rejects(loading, /변경됐어요/)
  assert.equal(s.life.settings.rent, 55.0003)
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
