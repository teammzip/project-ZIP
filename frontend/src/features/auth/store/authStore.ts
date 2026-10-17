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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: saved?.user ?? null,
  token: saved?.token ?? null,

  setAuth(user, token, remember) {
    remove(KEY, remember ? 'session' : 'local')
    writeJSON(KEY, { user, token } satisfies Session, remember ? 'local' : 'session')
    set({ user, token })
  },

  clearAuth() {
    remove(KEY, 'local')
    remove(KEY, 'session')
    set({ user: null, token: null })
  },
}))

export const selectIsLoggedIn = (s: AuthState) => s.token !== null
