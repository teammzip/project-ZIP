import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { useLifeStore } from '@/features/life'
import { ALL_PLACES, DEFAULT_CATS } from '../data/places'
import { useMapStore } from '../store'
import styles from './HomeMapCard.module.css'
import mapStyles from './MapView.module.css'

// 지도 라이브러리(Leaflet)는 크기가 커서 홈에서도 지도가 그려질 때 받아 옴
const LeafletMap = lazy(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })))

const NO_FOCUS = null
const noop = () => {}

/** 홈 "우리 동네 지도" 카드: 기본 칩 장소들이 찍힌 작은 지도. 보기만 하고, 어디를 눌러도 동네(지도) 화면으로 */
export function HomeMapCard() {
  const region = useLifeStore((s) => s.settings.region)
  const on = useMapStore((s) => s.on)
  const kinds = on.length ? on : DEFAULT_CATS
  const places = ALL_PLACES.filter((p) => kinds.includes(p.cat))
  const place = region.split(' ').slice(1).join(' ') || region || '우리 동네'

  return (
    <Card
      className={styles.card}
      title={`${place} 지도`}
      actions={
        <Link to="/map" className={styles.more}>
          지도 크게 보기
        </Link>
      }
    >
      <div className={styles.frame}>
        <Suspense fallback={<div className={styles.loading}>지도를 불러오는 중…</div>}>
          <LeafletMap className={mapStyles.map} places={places} selectedId={null} onSelect={noop} focus={NO_FOCUS} fitKey={kinds.join(',')} bottomInset={0} readOnly />
        </Suspense>
        {/* 지도 위를 덮는 링크: 어디를 눌러도 동네 화면으로 */}
        <Link to="/map" className={styles.cover} aria-label="동네 지도 크게 보기" />
      </div>
    </Card>
  )
}
