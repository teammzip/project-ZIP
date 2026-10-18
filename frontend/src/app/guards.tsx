import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectIsLoggedIn, selectNeedsConsent, useAuthStore } from '@/features/auth'
import { useRedirectAfterAuth } from './useRedirectAfterAuth'

/** 로그인해야 들어갈 수 있는 화면. 아니면 시작 화면으로 보내고, 로그인 뒤 원래 가려던 곳으로 돌아옴 */
export function ProtectedRoute() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn)
  const needsConsent = useAuthStore(selectNeedsConsent)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to="/start" replace state={{ from: location.pathname + location.search }} />
  // 소셜 첫 가입: 약관 동의 전에는 앱 화면에 못 들어가고 동의 화면만 보임
  if (needsConsent && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />
  if (!needsConsent && location.pathname === '/welcome') return <Navigate to="/" replace />
  return <Outlet />
}

/** 로그인하지 않은 사람만 보는 화면(시작·로그인·회원가입).
 * 로그인되는 순간 이 화면들은 사라지므로, 원래 가려던 곳(없으면 홈)으로 보내는 일도 여기서 함 */
export function GuestRoute() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn)
  const redirectTo = useRedirectAfterAuth()
  if (isLoggedIn) return <Navigate to={redirectTo} replace />
  return <Outlet />
}
