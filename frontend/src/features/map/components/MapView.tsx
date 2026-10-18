import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { PLACE_KINDS, PLACES, type Place } from '../data/places'
import styles from './MapView.module.css'

const embedUrl = (p: Place) => {
  const bbox = [p.lon - 0.004, p.lat - 0.0025, p.lon + 0.004, p.lat + 0.0025].join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${p.lat}%2C${p.lon}`
}
const bigUrl = (p: Place) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`

/** 우리 동네 지도(OpenStreetMap) + 주변 장소 목록. ?cat=세탁방 으로 열면 그 종류부터 보여줌 */
export function MapView() {
  const [params] = useSearchParams()
  const initial = params.get('cat')
  const [kind, setKind] = useState(initial && PLACES[initial] ? initial : PLACE_KINDS[0])
  const [idx, setIdx] = useState(0)
  const place = PLACES[kind][idx]

  return (
    <div className={common.layout}>
      <Card
        title="우리 동네 지도"
        actions={
          <a className={common.link} href={bigUrl(place)} target="_blank" rel="noopener noreferrer">
            큰 지도로 보기
          </a>
        }
      >
        <iframe className={styles.frame} src={embedUrl(place)} title="동네 지도" loading="lazy" />
        <p className={common.note}>장소 목록은 예시 데이터입니다. 지도는 OpenStreetMap을 사용하며 인터넷 연결이 필요해요.</p>
      </Card>

      <Card title="주변 장소">
        <div className={common.chips}>
          {PLACE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={cx(common.chip, k === kind && common.chipOn)}
              aria-pressed={k === kind}
              onClick={() => {
                setKind(k)
                setIdx(0)
              }}
            >
              {k}
            </button>
          ))}
        </div>
        {PLACES[kind].map((p, i) => (
          <button key={p.n} type="button" className={cx(styles.place, i === idx && styles.on)} aria-pressed={i === idx} onClick={() => setIdx(i)}>
            <b>{p.n}</b>
            <small>{p.d}</small>
          </button>
        ))}
      </Card>
    </div>
  )
}
