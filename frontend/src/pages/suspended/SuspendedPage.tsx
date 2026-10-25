import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuthStore, useLogout } from '@/features/auth'
import { SuspendedNotice, useActiveBan } from '@/features/moderation'
import styles from './SuspendedPage.module.css'

/* 이용 정지 화면
 * 정지된 계정은 ProtectedRoute 가 앱 대신 이 화면으로 보냄. 메뉴 없이 로그아웃 · 문의만.
 * 정지 중이 아니면 홈으로. 단 ?demo 를 붙이면 예시(3일 정지)를 보여 줌 (시안의 "정지 화면" 예시 버튼) */
export function SuspendedPage() {
  const user = useAuthStore((s) => s.user)
  const ban = useActiveBan(user?.nickname, user?.username)
  const [params] = useSearchParams()
  const logout = useLogout()
  if (!ban && !params.has('demo')) return <Navigate to="/" replace />

  return (
    <div className={styles.page}>
      <SuspendedNotice record={ban} onLogout={() => logout.mutate()} logoutPending={logout.isPending} />
    </div>
  )
}
