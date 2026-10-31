import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { RegionVerifyDialog } from '@/features/life'
import { ALL_PLACES, DEFAULT_CATS } from '../data/places'
import { useMapStore } from '../store'
import { useNeighborhoodPosition } from '../useNeighborhoodPosition'
import styles from './HomeMapCard.module.css'
import mapStyles from './MapView.module.css'

// 지도 라이브러리(Leaflet)는 크기가 커서 홈에서도 지도가 그려질 때 받아 옴
const LeafletMap = lazy(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })))

const NO_FOCUS = null
const noop = () => {}
const PREVIEW_ZOOM = 16

/** 홈 지도: 저장한 동네 중심을 표시하고 위치 인증 시 변경된 주소를 반영한다. */
export function HomeMapCard() {
  const [verifyOpen, setVerifyOpen] = useState(false)
  const position = useNeighborhoodPosition()
  const on = useMapStore((s) => s.on)
  const kinds = on.length ? on : DEFAULT_CATS
  const places = ALL_PLACES.filter((p) => kinds.includes(p.cat))
  const center = position.point

  return (
    <Card
      className={styles.card}
      title="내 주변 지도"
      actions={
        <Link to="/map" state={{ mapCenter: position.point }} className={styles.more}>
          지도 크게 보기
        </Link>
      }
    >
      <div className={styles.frame}>
        {center ? <Suspense fallback={<div className={styles.loading}>지도를 불러오는 중…</div>}>
          <LeafletMap
            className={mapStyles.map} places={places} selectedId={null} onSelect={noop}
            focus={NO_FOCUS} fitKey={kinds.join(',')} bottomInset={0} readOnly
            viewport={{ ...center, zoom: PREVIEW_ZOOM }}
          />
        </Suspense> : <p role="status">{position.loading ? '저장한 동네를 찾고 있어요.' : position.error}</p>}
        {/* 지도 위를 덮는 링크: 어디를 눌러도 동네 화면으로 */}
        <Link to="/map" state={{ mapCenter: position.point }} className={styles.cover} aria-label="동네 지도 크게 보기" />
        <button type="button" className={styles.locate} onClick={() => setVerifyOpen(true)} aria-label="현 위치로 동네 인증" aria-haspopup="dialog">
          ◎ 현 위치
        </button>
      </div>
      <p className={styles.status} role="status">
        {position.loading ? '저장한 동네를 찾고 있어요.' : position.error || '설정한 동네 중심을 표시해요. 주변 장소 표시는 예시 데이터예요.'}
      </p>
      <RegionVerifyDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </Card>
  )
}
