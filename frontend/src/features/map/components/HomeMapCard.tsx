import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { ALL_PLACES, DEFAULT_CATS, HOME } from '../data/places'
import { useMapStore } from '../store'
import { useCurrentMapPosition } from '../useCurrentMapPosition'
import styles from './HomeMapCard.module.css'
import mapStyles from './MapView.module.css'

// 지도 라이브러리(Leaflet)는 크기가 커서 홈에서도 지도가 그려질 때 받아 옴
const LeafletMap = lazy(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })))

const NO_FOCUS = null
const noop = () => {}
const PREVIEW_ZOOM = 16

/** 홈 지도: 실제 현재 위치 주변을 가까이 표시. 위치를 확인할 수 없으면 예시 지도로 안내. */
export function HomeMapCard() {
  const position = useCurrentMapPosition()
  const on = useMapStore((s) => s.on)
  const kinds = on.length ? on : DEFAULT_CATS
  const places = ALL_PLACES.filter((p) => kinds.includes(p.cat))
  const center = position.point ?? HOME

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
        <Suspense fallback={<div className={styles.loading}>지도를 불러오는 중…</div>}>
          <LeafletMap
            className={mapStyles.map} places={places} selectedId={null} onSelect={noop}
            focus={NO_FOCUS} fitKey={kinds.join(',')} bottomInset={0} readOnly
            viewport={{ ...center, zoom: PREVIEW_ZOOM }} currentPosition={position.point}
          />
        </Suspense>
        {/* 지도 위를 덮는 링크: 어디를 눌러도 동네 화면으로 */}
        <Link to="/map" state={{ mapCenter: position.point }} className={styles.cover} aria-label="동네 지도 크게 보기" />
        <button type="button" className={styles.locate} onClick={position.retry} disabled={position.loading} aria-label="현재 위치 다시 확인">
          {position.loading ? '위치 확인 중…' : '◎ 내 위치'}
        </button>
      </div>
      <p className={styles.status} role="status">
        {position.loading ? '내 위치를 확인하고 있어요.' : position.error ? `${position.error} ${position.point ? '마지막으로 확인한 위치를 표시하고 있어요.' : '예시 지도를 표시하고 있어요.'}` : '파란 점이 내 위치예요. 주변 장소 표시는 예시 데이터예요.'}
      </p>
    </Card>
  )
}
