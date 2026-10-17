import { useLocation } from 'react-router-dom'

/** 로그인·회원가입 성공 후 돌아갈 주소 (ProtectedRoute 가 넘겨준 from, 없으면 홈) */
export function useRedirectAfterAuth() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return from && from.startsWith('/') ? from : '/'
}
