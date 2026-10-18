import { readJSON, writeJSON } from '@/lib/storage'
import type { AuthApi, AuthResponse, SocialProvider, User } from '../types'

/* 백엔드가 준비되기 전까지 쓰는 가짜 API. 가입한 계정은 이 브라우저(localStorage)에만 저장됩니다.
 * 실제 서버처럼 약간 기다렸다가 응답하고, 실패하면 에러를 던집니다.
 * 휴대전화 인증은 아무 6자리 숫자나 통과합니다 (문자는 실제로 보내지 않음).
 * ⚠️ 가짜라서 비밀번호를 그대로 저장합니다. 실제 서버는 반드시 해시(bcrypt 등)로 저장해야 해요. */

type MockAccount = User & { password: string; phone?: string }

const USERS_KEY = 'zip-mock-users'
const SOCIAL_NAMES: Record<SocialProvider, string> = { kakao: '카카오', google: '구글', naver: '네이버' }

/** 가입 없이 바로 둘러보는 데모 계정 (가짜 API 모드에서만 있음, 팀 시안 shared/zip-password.js 와 같은 값).
 * 아이디·이메일 둘 다로 로그인 가능, 아이디·비밀번호 찾기는 닉네임 "지기" + 휴대전화 010-1234-5678 */
export const DEMO_ACCOUNT = { username: 'zipdemo', email: 'demo@zip.com', password: 'zip12345', nickname: '지기', phone: '010-1234-5678' }
const DEMO: MockAccount = {
  id: 'demo',
  ...DEMO_ACCOUNT,
  address: '서울시 마포구 합정동',
  provider: 'email',
  agreedAt: '2026-10-18T00:00:00.000Z',
}

const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms))
const loadAccounts = () => {
  const list = readJSON<MockAccount[]>(USERS_KEY) ?? []
  // 데모 계정은 저장된 게 있으면 그걸 씀 (비밀번호를 바꿨을 수 있어서). 예전 형식(아이디 없음)이면 새로
  const saved = list.find((a) => a.id === DEMO.id && a.username)
  return [saved ?? DEMO, ...list.filter((a) => a.id !== DEMO.id)]
}
const saveAccounts = (list: MockAccount[]) => writeJSON(USERS_KEY, list)

function toResponse({ password: _password, phone: _phone, ...user }: MockAccount): AuthResponse {
  return { accessToken: `mock-token-${user.id}`, user }
}

const same = (a: string, b: string) => a.replace(/\s/g, '') === b.replace(/\s/g, '')
const digits = (p = '') => p.replace(/\D/g, '')
/** 인증을 마친 휴대전화 번호 → 인증 토큰 (가짜 서버의 기억) */
const verifiedPhones = new Map<string, string>()
const resetTokens = new Map<string, string>() // 재설정 토큰 → 계정 id

let currentId: string | null = null

/** 새로고침하면 currentId 가 비므로, 저장된 가짜 토큰(mock-token-<id>)에서 꺼냄 */
function currentAccountId() {
  if (currentId) return currentId
  const saved = readJSON<{ token?: string }>('zip-auth') ?? readJSON<{ token?: string }>('zip-auth', 'session')
  return saved?.token?.replace('mock-token-', '') ?? null
}

export const mockAuthApi: AuthApi = {
  async login({ loginId, password }) {
    await wait()
    const id = loginId.trim().toLowerCase()
    const account = loadAccounts().find((a) => a.email === id || a.username === id)
    if (!account || account.password !== password) throw new Error('아이디(이메일) 또는 비밀번호가 맞지 않아요.')
    currentId = account.id
    return toResponse(account)
  },

  async sendPhoneCode() {
    await wait(300)
  },

  async verifyPhoneCode(phone, code, purpose) {
    await wait(300)
    if (!/^\d{6}$/.test(code)) throw new Error('인증번호 6자리를 입력해 주세요.')
    const token = `mock-${purpose}-${digits(phone)}-${Date.now()}`
    verifiedPhones.set(token, digits(phone))
    return { verificationToken: token }
  },

  async signup(req) {
    await wait()
    const accounts = loadAccounts()
    const email = req.email.toLowerCase()
    if (accounts.some((a) => a.username === req.username)) throw new Error('이미 쓰고 있는 아이디예요.')
    if (accounts.some((a) => a.email === email)) throw new Error('이미 가입된 이메일이에요.')
    if (!req.phoneVerificationToken) throw new Error('휴대전화 인증을 해 주세요.')
    const account: MockAccount = {
      id: crypto.randomUUID(),
      username: req.username,
      email,
      password: req.password,
      nickname: req.nickname,
      phone: req.phone,
      address: req.address,
      provider: 'email',
      agreedAt: new Date().toISOString(),
    }
    saveAccounts([...accounts, account])
    currentId = account.id
    return toResponse(account)
  },

  async findId({ nickname, phone, phoneVerificationToken }) {
    await wait()
    if (verifiedPhones.get(phoneVerificationToken) !== digits(phone)) throw new Error('휴대전화 인증을 다시 해 주세요.')
    const account = loadAccounts().find((a) => a.username && same(a.nickname, nickname) && digits(a.phone) === digits(phone))
    if (!account?.username) throw new Error('입력한 정보와 일치하는 계정을 찾을 수 없어요. 닉네임과 휴대전화를 다시 확인해 주세요.')
    return { username: account.username }
  },

  async verifyPasswordReset({ username, phone, phoneVerificationToken }) {
    await wait()
    if (verifiedPhones.get(phoneVerificationToken) !== digits(phone)) throw new Error('휴대전화 인증을 다시 해 주세요.')
    const account = loadAccounts().find((a) => a.username === username.trim().toLowerCase() && digits(a.phone) === digits(phone))
    if (!account) throw new Error('입력한 정보와 일치하는 계정을 찾을 수 없어요. 아이디와 휴대전화를 다시 확인해 주세요.')
    const resetToken = crypto.randomUUID()
    resetTokens.set(resetToken, account.id)
    return { resetToken }
  },

  async resetPassword({ resetToken, newPassword }) {
    await wait()
    const id = resetTokens.get(resetToken)
    if (!id) throw new Error('본인 확인이 만료됐어요. 처음부터 다시 해 주세요.')
    resetTokens.delete(resetToken) // 한 번만 쓸 수 있음
    saveAccounts(loadAccounts().map((a) => (a.id === id ? { ...a, password: newPassword } : a)))
  },

  async changePassword({ currentPassword, newPassword }) {
    await wait()
    const id = currentAccountId()
    const accounts = loadAccounts()
    const account = accounts.find((a) => a.id === id)
    if (!account) throw new Error('로그인 정보가 없어요.')
    if (account.password !== currentPassword) throw new Error('현재 비밀번호가 맞지 않아요.')
    saveAccounts(accounts.map((a) => (a.id === id ? { ...a, password: newPassword } : a)))
  },

  async me() {
    await wait(150)
    const account = loadAccounts().find((a) => a.id === currentAccountId())
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
      // 소셜로 처음 들어오면 아직 동의·주소가 없음 → 앱이 /welcome 동의 화면으로 보냄
      account = { id: crypto.randomUUID(), email, password: '', nickname: `${SOCIAL_NAMES[provider]} 사용자`, address: '', provider, agreedAt: null }
      saveAccounts([...accounts, account])
    }
    currentId = account.id
    return toResponse(account)
  },

  async updateMe(req) {
    await wait(150)
    const id = currentAccountId()
    const agreed = req.agreeTerms && req.agreePrivacy && req.agreePolicy && req.ageOver14
    const accounts = loadAccounts().map((a) =>
      a.id === id
        ? {
            ...a,
            nickname: req.nickname ?? a.nickname,
            address: req.address ?? a.address,
            agreedAt: agreed ? new Date().toISOString() : a.agreedAt,
          }
        : a,
    )
    saveAccounts(accounts)
    const account = accounts.find((a) => a.id === id)
    if (!account) throw new Error('로그인 정보가 없어요.')
    return toResponse(account).user
  },

  async withdraw() {
    await wait()
    const id = currentAccountId()
    // 데모 계정은 지워도 다시 생김 (둘러보기용)
    saveAccounts(loadAccounts().filter((a) => a.id !== id && a.id !== DEMO.id))
    currentId = null
  },
}
