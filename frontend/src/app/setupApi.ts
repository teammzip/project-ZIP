import { useAuthStore } from '@/features/auth'
import { bindAuth } from '@/lib/apiClient'
import { useLifeStore } from '@/features/life/store'

// 로그인한 회원의 저장 주소로 시작한다. 다른 회원의 동네 설정을 이어 쓰지 않는다.
function syncAddress() {
  const user = useAuthStore.getState().user
  if (!user) return
  const { settings, saveSettings } = useLifeStore.getState()
  const region = user.address.trim()
  if (settings.region !== region) saveSettings({ ...settings, region })
}
syncAddress()
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.user?.address !== previous.user?.address) syncAddress()
})

/* apiClient 에 "토큰은 어디서 읽고, 401 이면 무엇을 할지" 연결 (main.tsx 에서 한 번 불러옴) */
bindAuth({
  getToken: () => useAuthStore.getState().token,
  // 로그인 상태를 비우면 ProtectedRoute 가 알아서 시작 화면으로 보냄
  onUnauthorized: () => useAuthStore.getState().clearAuth(),
})
