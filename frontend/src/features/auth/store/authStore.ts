import { create } from 'zustand'
import { readJSON, remove, writeJSON } from '@/lib/storage'
import type { User } from '../types'

/* 로그인 상태(누가 로그인했는지 + 토큰)를 앱 전체에서 공유.
 * "로그인 유지"를 켜면 localStorage(브라우저를 닫아도 유지), 끄면 sessionStorage(탭을 닫으면 로그아웃)에 저장. */

/** loggedInAt: 로그인한 시각(ms). 내 정보에 "10월 24일 11:33 로그인"처럼 보여 줌 */
type Session = { user: User; token: string; loggedInAt?: number }

const KEY = 'zip-auth'
const temporary = readJSON<Session>(KEY, 'session')
const saved = temporary ?? readJSON<Session>(KEY, 'local')
let sessionNumber = 0

export function readSessionId(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    const { sid } = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')))
    return typeof sid === 'string' && /^\d+$/.test(sid) ? sid : null
  } catch {
    return null
  }
}

function sameSession(left: string, right: string) {
  const id = readSessionId(left)
  return left === right || (id !== null && id === readSessionId(right))
}

export function readSharedToken(token: string) {
  const saved = readJSON<Session>(KEY, 'local')
  return saved?.token && sameSession(token, saved.token) ? saved.token : null
}

type AuthState = {
  user: User | null
  token: string | null
  /** 액세스 토큰이 교체돼도 요청과 화면에 같은 로그인 세션을 표시한다. */
  sessionKey: string | null
  remember: boolean
  loggedInAt: number | null
  setAuth: (user: User, token: string, remember: boolean) => void
  clearAuth: () => void
  replaceToken: (token: string) => void
  /** 닉네임 등 내 정보가 바뀌었을 때 (토큰·저장 위치는 그대로) */
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: saved?.user ?? null,
  token: saved?.token ?? null,
  sessionKey: saved?.token ? String(++sessionNumber) : null,
  remember: !!saved && !temporary,
  loggedInAt: saved?.loggedInAt ?? null,

  setAuth(user, token, remember) {
    const loggedInAt = Date.now()
    remove(KEY, remember ? 'session' : 'local')
    writeJSON(KEY, { user, token, loggedInAt } satisfies Session, remember ? 'local' : 'session')
    set({ user, token, loggedInAt, remember, sessionKey: String(++sessionNumber) })
  },

  replaceToken(token) {
    const current = get()
    if (!current.token || !current.user || !sameSession(current.token, token)) return
    if (!current.remember || readSharedToken(current.token)) {
      writeJSON(KEY, { user: current.user, token, loggedInAt: current.loggedInAt ?? undefined } satisfies Session,
        current.remember ? 'local' : 'session')
    }
    set({ token })
  },

  updateUser(user) {
    const { token, loggedInAt, remember } = get()
    const persisted = token && remember ? readSharedToken(token) : token
    if (persisted) writeJSON(KEY, { user, token: persisted, loggedInAt: loggedInAt ?? undefined } satisfies Session,
      remember ? 'local' : 'session')
    set({ user })
  },

  clearAuth() {
    const { token } = get()
    if (token && readSharedToken(token)) remove(KEY, 'local')
    remove(KEY, 'session')
    set({ user: null, token: null, sessionKey: null, loggedInAt: null, remember: false })
  },
}))

export const selectIsLoggedIn = (s: AuthState) => s.sessionKey !== null

/** 소셜 로그인으로 처음 들어와 아직 약관 동의·주소 입력을 안 한 상태 (이메일 가입은 가입할 때 동의함) */
export const selectNeedsConsent = (s: AuthState) => !!s.user && s.user.provider !== 'email' && !s.user.agreedAt
