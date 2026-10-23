import { Link } from 'react-router-dom'
import { AdminConsole } from '@/features/admin'
import { useAuthStore } from '@/features/auth'
import styles from './AdminPage.module.css'

/* 관리자 화면 (/admin): 로그인 + 관리자(ADMIN) 계정만. 일반 회원이 들어오면 안내만 보여 줌 */
export function AdminPage() {
  const user = useAuthStore((s) => s.user)
  if (user?.role !== 'ADMIN')
    return (
      <div className={styles.denied}>
        <h1>관리자만 들어올 수 있어요</h1>
        <p>관리자 계정으로 로그인해 주세요.</p>
        <Link to="/">홈으로 가기</Link>
      </div>
    )
  return <AdminConsole me={user.nickname} />
}
