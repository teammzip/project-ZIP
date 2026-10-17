import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 12, minHeight: '100dvh' }}>
      <h1 style={{ fontSize: 22 }}>페이지를 찾을 수 없어요</h1>
      <Link to="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
        홈으로 가기
      </Link>
    </div>
  )
}
