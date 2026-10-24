import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ProfileLook } from './types'

/* 프로필 꾸미기 저장 (localStorage 'zip-profile'). 데이터 초기화 · 회원 탈퇴 때 reset */
const EMPTY: ProfileLook = { avatarImg: '', avatarEmoji: '', avatarColor: '', bio: '' }

type ProfileState = ProfileLook & {
  save: (look: ProfileLook) => void
  reset: () => void
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...EMPTY,
      save: (look) => set(look),
      reset: () => set(EMPTY),
    }),
    { name: 'zip-profile', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

/** 사진을 저장해도 될 만큼 브라우저 저장 공간이 남았는지 미리 확인 */
export function canStore(look: ProfileLook) {
  try {
    localStorage.setItem('zip-profile-check', JSON.stringify(look))
    localStorage.removeItem('zip-profile-check')
    return true
  } catch {
    return false
  }
}
