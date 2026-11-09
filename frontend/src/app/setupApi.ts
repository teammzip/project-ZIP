import { useAuthStore } from '@/features/auth'
import { authApi, isMockApi } from '@/features/auth/api'
import { bindAuth } from '@/lib/apiClient'
import { useLifeStore } from '@/features/life/store'
import { useProfileStore } from '@/features/profile/store'

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

/* apiClient 에 "토큰은 어디서 읽고, 401 이면 무엇을 할지" 연결 (main.tsx 에서 한 번 불러옴) */
bindAuth({
  getToken: () => useAuthStore.getState().token,
  // 로그인 상태를 비우면 ProtectedRoute 가 알아서 시작 화면으로 보냄
  onUnauthorized: () => useAuthStore.getState().clearAuth(),
})

// 새로고침 시 Postman·다른 기기에서 변경된 내 정보도 서버에서 다시 받는다.
// 응답 대기 중 재로그인/정보 수정이 발생했다면 오래된 조회로 덮어쓰지 않는다.
const restoredSession = useAuthStore.getState()
if (!isMockApi && restoredSession.token) {
  void authApi.me().then((user) => {
    const current = useAuthStore.getState()
    if (current.token !== restoredSession.token || current.user !== restoredSession.user) return
    current.updateUser({
      ...user,
      // firstLogin은 로그인 응답의 일회성 설문 표시값이다. me의 false로 진행 중인 설문을 닫지 않는다.
      ...(restoredSession.user?.firstLogin !== undefined ? { firstLogin: restoredSession.user.firstLogin } : {}),
    })
  }).catch(() => {
    // 401은 apiClient가 처리한다. 일시적인 네트워크 오류에는 기존 표시 정보를 유지한다.
  })
}
