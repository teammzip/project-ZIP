import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api'
import type { LoginValues, SignupValues } from '../schema'
import { useAuthStore } from '../store/authStore'
import type { SocialProvider } from '../types'

/* 화면(컴포넌트)은 이 훅만 부르고, API·저장 방식은 몰라도 되게 합니다.
 * 반환값의 isPending(요청 중), error(실패 이유)로 버튼 비활성화·에러 문구를 처리하세요. */

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: async ({ email, password, remember }: LoginValues) => {
      const res = await authApi.login({ email, password })
      setAuth(res.user, res.accessToken, remember)
      return res.user
    },
  })
}

export function useSignup() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: async ({ nickname, email, password, address, agreeTerms }: SignupValues) => {
      const res = await authApi.signup({ nickname, email, password, address, agreeTerms })
      setAuth(res.user, res.accessToken, true)
      return res.user
    },
  })
}

export function useSocialLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const res = await authApi.startSocialLogin(provider)
      if (res) setAuth(res.user, res.accessToken, true) // 실제 API 는 페이지를 이동하므로 여기까지 안 옴
      return res?.user ?? null
    },
  })
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout().catch(() => {}), // 서버 로그아웃이 실패해도 화면에서는 로그아웃
    onSettled: () => {
      clearAuth()
      queryClient.clear() // 이전 사용자의 데이터가 남지 않게
    },
  })
}
