import { create } from 'zustand'
import { readJSON, remove, writeJSON } from '@/lib/storage'
import type { User } from '../types'

/* 로그인 상태(누가 로그인했는지 + 토큰)를 앱 전체에서 공유.
 * "로그인 유지"를 켜면 localStorage(브라우저를 닫아도 유지), 끄면 sessionStorage(탭을 닫으면 로그아웃)에 저장. */

type Session = { user: User; token: string }

const KEY = 'zip-auth'
const saved = readJSON<Session>(KEY, 'local') ?? readJSON<Session>(KEY, 'session')

type AuthState = {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string, remember: boolean) => void
  clearAuth: () => void
  /** 닉네임 등 내 정보가 바뀌었을 때 (토큰·저장 위치는 그대로) */
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: saved?.user ?? null,
  token: saved?.token ?? null,

  setAuth(user, token, remember) {
    remove(KEY, remember ? 'session' : 'local')
    writeJSON(KEY, { user, token } satisfies Session, remember ? 'local' : 'session')
    set({ user, token })
  },

  updateUser(user) {
    const where = readJSON<Session>(KEY, 'local') ? 'local' : 'session'
    const token = useAuthStore.getState().token
    if (token) writeJSON(KEY, { user, token } satisfies Session, where)
    set({ user })
  },

  clearAuth() {
    remove(KEY, 'local')
    remove(KEY, 'session')
    set({ user: null, token: null })
  },
}))

export const selectIsLoggedIn = (s: AuthState) => s.token !== null

/** 소셜 로그인으로 처음 들어와 아직 약관 동의·주소 입력을 안 한 상태 (이메일 가입은 가입할 때 동의함) */
export const selectNeedsConsent = (s: AuthState) => !!s.user && s.user.provider !== 'email' && !s.user.agreedAt
