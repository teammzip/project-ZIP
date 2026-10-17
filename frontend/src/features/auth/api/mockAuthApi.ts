import { readJSON, writeJSON } from '@/lib/storage'
import type { AuthApi, AuthResponse, SocialProvider, User } from '../types'

/* 백엔드가 준비되기 전까지 쓰는 가짜 API. 가입한 계정은 이 브라우저(localStorage)에만 저장됩니다.
 * 실제 서버처럼 약간 기다렸다가 응답하고, 실패하면 에러를 던집니다. */

type MockAccount = User & { password: string }

const USERS_KEY = 'zip-mock-users'
const SOCIAL_NAMES: Record<SocialProvider, string> = { kakao: '카카오', google: '구글', naver: '네이버' }

/** 가입 없이 바로 둘러보는 데모 계정 (가짜 API 모드에서만 있음) */
export const DEMO_ACCOUNT = { email: 'demo@zip.com', password: 'zip12345' }
const DEMO: MockAccount = {
  id: 'demo',
  ...DEMO_ACCOUNT,
  nickname: '지기',
  address: '서울시 마포구 합정동',
  provider: 'email',
}

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))
const loadAccounts = () => {
  const list = readJSON<MockAccount[]>(USERS_KEY) ?? []
  return list.some((a) => a.id === DEMO.id) ? list : [DEMO, ...list]
}
const saveAccounts = (list: MockAccount[]) => writeJSON(USERS_KEY, list)

function toResponse({ password: _password, ...user }: MockAccount): AuthResponse {
  return { accessToken: `mock-token-${user.id}`, user }
}

let currentId: string | null = null

export const mockAuthApi: AuthApi = {
  async login({ email, password }) {
    await wait()
    const account = loadAccounts().find((a) => a.email === email.toLowerCase())
    if (!account || account.password !== password) throw new Error('이메일 또는 비밀번호가 맞지 않아요.')
    currentId = account.id
    return toResponse(account)
  },

  async signup(req) {
    await wait()
    const accounts = loadAccounts()
    const email = req.email.toLowerCase()
    if (accounts.some((a) => a.email === email)) throw new Error('이미 가입된 이메일이에요.')
    const account: MockAccount = {
      id: crypto.randomUUID(),
      email,
      password: req.password,
      nickname: req.nickname,
      address: req.address,
      provider: 'email',
    }
    saveAccounts([...accounts, account])
    currentId = account.id
    return toResponse(account)
  },

  async me() {
    await wait(150)
    const account = loadAccounts().find((a) => a.id === currentId)
    if (!account) throw new Error('로그인 정보가 없어요.')
    return toResponse(account).user
  },

  async logout() {
    await wait(150)
    currentId = null
  },

  async startSocialLogin(provider) {
    await wait()
    const accounts = loadAccounts()
    const email = `${provider}-demo@zip.local`
    let account = accounts.find((a) => a.email === email)
    if (!account) {
      account = { id: crypto.randomUUID(), email, password: '', nickname: `${SOCIAL_NAMES[provider]} 사용자`, address: '', provider }
      saveAccounts([...accounts, account])
    }
    currentId = account.id
    return toResponse(account)
  },
}
