import { AdminConsole } from '@/features/admin'
import { useAuthStore, useLogout } from '@/features/auth'

/* 관리자 화면 (/admin): 관리자(ADMIN) 계정은 로그인하면 이 화면만 보임.
 * 누가 들어올 수 있는지는 ProtectedRoute 가 정함 (일반 회원은 홈으로, 관리자는 앱 화면 대신 여기로) */
export function AdminPage() {
  const nickname = useAuthStore((s) => s.user?.nickname ?? '관리자')
  const logout = useLogout()
  return <AdminConsole me={nickname} onLogout={() => logout.mutate()} logoutPending={logout.isPending} />
}
