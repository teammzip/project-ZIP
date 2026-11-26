import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { canAutoReload, isStaleChunkError, markAutoReload, tabStorage } from '@/lib/staleChunk'

/** 화면에서 오류가 났을 때 앱 전체가 흰 화면이 되는 대신 보여 주는 화면 (app/router.tsx 의 errorElement) */
export function RouteErrorPage() {
  const error = useRouteError()
  const stale = isStaleChunkError(error)
  // 새 버전 배포로 옛 화면 파일이 사라진 경우: 한 번만 저절로 새로고침해서 새 파일을 받음
  const reloading = stale && canAutoReload(tabStorage())

  useEffect(() => {
    if (reloading) {
      markAutoReload(tabStorage())
      window.location.reload()
    }
    else console.error(error) // 원인을 찾을 수 있게 개발자 도구에 남김
  }, [error, reloading])

  if (reloading) return null
  return (
    <div role="alert" style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 12, minHeight: '100dvh', padding: 16, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>{stale ? '새 버전이 나왔어요' : '화면을 여는 중에 문제가 생겼어요'}</h1>
      <p style={{ color: 'var(--color-muted)' }}>{stale ? '새로고침하면 최신 화면으로 열려요.' : '새로고침해도 계속되면 잠시 뒤에 다시 시도해 주세요.'}</p>
      <div style={{ display: 'flex', gap: 16 }}>
        <button type="button" onClick={() => window.location.reload()} style={{ color: 'var(--color-primary)', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }}>
          새로고침
        </button>
        {/* 라우터 상태가 꼬였을 수 있어 Link 대신 주소를 새로 엶 */}
        <a href="/" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>홈으로 가기</a>
      </div>
    </div>
  )
}
