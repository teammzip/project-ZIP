import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LEGAL_VERSION } from '@/features/legal'
import { authApi } from '../api'
import type { LoginValues, SignupValues } from '../schema'
import { useAuthStore } from '../store/authStore'
import type { ChangePasswordRequest, FindIdRequest, PasswordResetRequest, PasswordResetVerifyRequest, PhonePurpose, SocialProvider, UpdateMeRequest } from '../types'

/* 화면(컴포넌트)은 이 훅만 부르고, API·저장 방식은 몰라도 되게 합니다.
 * 반환값의 isPending(요청 중), error(실패 이유)로 버튼 비활성화·에러 문구를 처리하세요. */

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: async ({ loginId, password, remember }: LoginValues) => {
      const res = await authApi.login({ loginId, password, remember })
      setAuth(res.user, res.accessToken, remember)
      return res.user
    },
  })
}

export function useSignup() {
  const setAuth = useAuthStore((s) => s.setAuth)
  return useMutation({
    mutationFn: async (v: SignupValues) => {
      const res = await authApi.signup({
        username: v.username,
        password: v.password,
        nickname: v.nickname,
        phone: `010-${v.phone}`,
        phoneVerificationToken: v.phoneToken,
        email: v.email,
        address: v.address,
        agreeTerms: v.agreeTerms,
        agreePrivacy: v.agreePrivacy,
        agreePolicy: v.agreePolicy,
        ageOver14: v.ageOver14,
        termsVersion: LEGAL_VERSION,
      })
      setAuth(res.user, res.accessToken, true)
      return res.user
    },
  })
}

/** 휴대전화 인증: send(번호) → verify(번호, 6자리) 가 성공하면 verificationToken 을 돌려줌 */
export function usePhoneVerification(purpose: PhonePurpose) {
  const send = useMutation({ mutationFn: (phone: string) => authApi.sendPhoneCode(phone, purpose) })
  const verify = useMutation({ mutationFn: ({ phone, code }: { phone: string; code: string }) => authApi.verifyPhoneCode(phone, code, purpose) })
  return { send, verify }
}

export function useFindId() {
  return useMutation({ mutationFn: (req: FindIdRequest) => authApi.findId(req) })
}

/** 비밀번호 찾기: verify(아이디 + 휴대전화 인증) → reset(재설정 토큰 + 새 비밀번호) */
export function usePasswordReset() {
  const verify = useMutation({ mutationFn: (req: PasswordResetVerifyRequest) => authApi.verifyPasswordReset(req) })
  const reset = useMutation({ mutationFn: (req: PasswordResetRequest) => authApi.resetPassword(req) })
  return { verify, reset }
}

export function useChangePassword() {
  return useMutation({ mutationFn: (req: ChangePasswordRequest) => authApi.changePassword(req) })
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

export function useUpdateMe() {
  const updateUser = useAuthStore((s) => s.updateUser)
  return useMutation({
    mutationFn: (req: UpdateMeRequest) => authApi.updateMe(req),
    onSuccess: (user) => updateUser(user),
  })
}

/** 회원 탈퇴: 서버 계정 삭제. 성공 후 로그아웃·이 기기 데이터 삭제는 쓰는 쪽(onSuccess)에서 처리 */
export function useWithdraw() {
  return useMutation({ mutationFn: () => authApi.withdraw() })
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
