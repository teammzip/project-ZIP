import { useAuthStore } from '@/features/auth'
import { authApi, isMockApi } from '@/features/auth/api'
import { bindAuth, publicAuthClient } from '@/lib/apiClient'
import { readSessionId, readSharedToken } from '@/features/auth/store/authStore'
import { isAxiosError } from 'axios'
import { useLifeStore } from '@/features/life/store'
import { useProfileStore } from '@/features/profile/store'
import { loadHomeInfo, removeHomeInfo } from '@/features/life/homeApi'

// 로그인한 회원의 저장 주소로 시작한다. 다른 회원의 동네 설정을 이어 쓰지 않는다.
function syncAddress() {
  const user = useAuthStore.getState().user
  if (!user) return
  const { settings, saveSettings } = useLifeStore.getState()
  // 계정별로 복원한 동네 선택은 가입 주소로 덮어쓰지 않는다.
  if (settings.regionLocation?.userId === user.id) return
  const region = user.address.trim()
  if (settings.region !== region) saveSettings({ ...settings, region })
}
syncAddress()
function syncProfile() {
  if (isMockApi) return
  const user = useAuthStore.getState().user
  let avatarImg = user?.avatarUrl ?? ''
  const base = import.meta.env.VITE_API_BASE_URL
  if (avatarImg && base && /^https?:\/\//.test(base)) avatarImg = new URL(avatarImg, base).href
  useProfileStore.getState().save({
    avatarImg, bio: user?.bio ?? '', avatarEmoji: user?.avatarEmoji ?? '', avatarColor: user?.avatarColor ?? '',
  })
}
syncProfile()
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.user?.address !== previous.user?.address) syncAddress()
  if (state.user !== previous.user) syncProfile()
})

async function refreshAccess(sessionKey: string | null, token: string | null) {
  if (!sessionKey || !token) return
  const id = readSessionId(token)
  if (isMockApi || !id) {
    if (useAuthStore.getState().sessionKey === sessionKey) useAuthStore.getState().clearAuth()
    return
  }
  const refresh = async () => {
    const current = useAuthStore.getState()
    if (current.sessionKey !== sessionKey || current.token !== token) return
    const shared = current.remember ? readSharedToken(token) : null
    if (shared && shared !== token) {
      current.replaceToken(shared)
      return
    }
    const { data } = await publicAuthClient.post<{ accessToken: string }>('/auth/refresh', undefined, {
      headers: { 'X-Zip-Session': id },
    })
    if (useAuthStore.getState().sessionKey === sessionKey) current.replaceToken(data.accessToken)
  }
  if (navigator.locks) {
    await navigator.locks.request('zip-auth-refresh', refresh)
    return
  }
  try {
    await refresh()
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 401) throw error
    // Web Locks를 쓸 수 없는 환경에서도 다른 탭이 갱신 중일 수 있다.
    await new Promise((resolve) => setTimeout(resolve, 200))
    await refresh()
  }
}

bindAuth({
  getSession: () => {
    const { sessionKey, token } = useAuthStore.getState()
    return { key: sessionKey, token }
  },
  refresh: ({ key, token }) => refreshAccess(key, token),
  onUnauthorized: () => useAuthStore.getState().clearAuth(),
  // 쓰는 중에 이용 정지되면 (서버가 403 SUSPENDED) 안내하고 로그아웃 → 다시 로그인하면 정지 기간 · 사유가 보여요
  onSuspended: (message) => {
    useAuthStore.getState().clearAuth()
    window.alert(message)
  },
})

const restoredSession = useAuthStore.getState()
const restoring = !isMockApi && restoredSession.sessionKey && window.location.pathname !== '/oauth/callback'
if (restoring && restoredSession.user && restoredSession.user.role !== 'ADMIN') void loadHomeInfo().catch(() => {})
useAuthStore.subscribe((state, previous) => {
  if (isMockApi || (state.sessionKey === previous.sessionKey && state.user?.id === previous.user?.id)) return
  if (previous.user && previous.sessionKey) removeHomeInfo(previous.user.id, previous.sessionKey)
  if (state.sessionKey && state.user && state.user.role !== 'ADMIN') void loadHomeInfo().catch(() => {})
})

// 새로고침 시 Postman·다른 기기에서 변경된 내 정보도 서버에서 다시 받는다.
// 응답 대기 중 재로그인/정보 수정이 발생했다면 오래된 조회로 덮어쓰지 않는다.
if (restoring) {
  void authApi.me().then((user) => {
    const current = useAuthStore.getState()
    if (current.sessionKey !== restoredSession.sessionKey || current.user !== restoredSession.user) return
    current.updateUser(user)
  }).catch(() => {
    // 세션 만료는 apiClient가 처리한다. 통신 오류에는 기존 표시 정보를 유지한다.
  })
}
