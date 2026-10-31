import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectIsLoggedIn, selectNeedsConsent, useAuthStore } from '@/features/auth'
import { useActiveBan } from '@/features/moderation'
import { useRedirectAfterAuth } from './useRedirectAfterAuth'

/** 로그인해야 들어갈 수 있는 화면. 아니면 시작 화면으로 보내고, 로그인 뒤 원래 가려던 곳으로 돌아옴 */
export function ProtectedRoute() {
  const isLoggedIn = useAuthStore(selectIsLoggedIn)
  const needsConsent = useAuthStore(selectNeedsConsent)
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  const user = useAuthStore((s) => s.user)
  const ban = useActiveBan(user?.nickname, user?.username)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to="/start" replace state={{ from: location.pathname + location.search }} />
  // 이용 정지 중이면 앱 대신 정지 안내만 (안내 화면은 예시 보기를 위해 언제나 들어갈 수 있음)
  if (location.pathname === '/suspended') return <Outlet />
  if (ban && !isAdmin) return <Navigate to="/suspended" replace />
  // 관리자 계정은 관리자 화면만, 일반 회원은 관리자 화면 빼고 전부
  const onAdmin = location.pathname === '/admin'
  if (isAdmin !== onAdmin) return <Navigate to={isAdmin ? '/admin' : '/'} replace />
  // 소셜 첫 가입: 약관 동의 전에는 앱 화면에 못 들어가고 동의 화면만 보임
  if (needsConsent && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />
  if (!needsConsent && location.pathname === '/welcome') return <Navigate to="/" replace />
  // 처음 로그인(가입 직후): 우리 집 설문 페이지를 한 번 거침. 끝내거나 건너뛰면 firstLogin 이 꺼져서 앱으로
  if (user?.firstLogin && !isAdmin && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (!user?.firstLogin && location.pathname === '/onboarding') return <Navigate to="/" replace />
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
