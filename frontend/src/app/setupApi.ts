import { useAuthStore } from '@/features/auth'
import { bindAuth } from '@/lib/apiClient'

/* apiClient 에 "토큰은 어디서 읽고, 401 이면 무엇을 할지" 연결 (main.tsx 에서 한 번 불러옴) */
bindAuth({
  getToken: () => useAuthStore.getState().token,
  // 로그인 상태를 비우면 ProtectedRoute 가 알아서 시작 화면으로 보냄
  onUnauthorized: () => useAuthStore.getState().clearAuth(),
})
