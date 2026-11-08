import { apiClient } from '@/lib/apiClient'
import type { UpdateMeRequest } from '@/features/auth/types'
import type { ProfileLook } from './types'
import { useAuthStore } from '@/features/auth/store/authStore'

/** Existing remote picture is preserved by omitting avatarFileId. Empty picture explicitly clears it. */
export async function createProfilePatch(nickname: string, look: ProfileLook, token: string | null): Promise<UpdateMeRequest> {
  const patch: UpdateMeRequest = {
    nickname,
    bio: look.bio,
    avatarEmoji: look.avatarEmoji || null,
    avatarColor: look.avatarColor || null,
  }
  if (!look.avatarImg) patch.avatarFileId = null
  else if (look.avatarImg.startsWith('data:image/')) {
    const blob = await (await fetch(look.avatarImg)).blob()
    const form = new FormData()
    form.append('file', blob, 'profile.jpg')
    if (!token || useAuthStore.getState().token !== token) throw new Error('로그인 상태가 바뀌었어요. 다시 시도해 주세요.')
    const { data } = await apiClient.post<{ id: string }>('/files', form)
    patch.avatarFileId = data.id
  }
  return patch
}
