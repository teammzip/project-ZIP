import { createJSONStorage } from 'zustand/middleware'
import { useAuthStore } from '@/features/auth/store/authStore'

/* 회원별로 따로 저장하는 localStorage 도우미.
 * 키는 `<prefix>:user:<회원 id>` 이고, 로그아웃 상태에서는 아무것도 읽거나 쓰지 않아요.
 * 예전에 모든 회원이 함께 쓰던 `<prefix>` 키는 주인을 알 수 없어서 건드리지도, 배정하지도 않아요. */
const idOf = (auth: ReturnType<typeof useAuthStore.getState>) => (auth.token ? auth.user?.id ?? null : null)

export function createAccountStorage<T>(prefix: string) {
  let active = idOf(useAuthStore.getState())
  const key = () => (active === null ? null : `${prefix}:user:${encodeURIComponent(active)}`)
  const storage = createJSONStorage<T>(() => ({
    getItem: () => { const k = key(); return k ? localStorage.getItem(k) : null },
    setItem: (_name, value) => { const k = key(); if (k) localStorage.setItem(k, value) },
    removeItem: () => { const k = key(); if (k) localStorage.removeItem(k) },
  }))
  /** 회원이 바뀌면 화면 상태를 비우고, 새 회원의 저장본을 다시 불러옴 */
  const bind = (reset: () => void, rehydrate: () => unknown) =>
    useAuthStore.subscribe((auth) => {
      const next = idOf(auth)
      if (next === active) return
      active = null
      reset()
      active = next
      if (next !== null) void rehydrate()
    })
  return { storage, bind }
}
