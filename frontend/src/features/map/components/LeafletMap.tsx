import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { CAT_ICON, HOME, type PlaceItem } from '../data/places'

type Props = {
  places: PlaceItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** 바뀔 때마다 지도를 그 장소로 옮김 */
  focus: { lat: number; lon: number; n: number } | null
  /** 바뀔 때마다 지금 장소들이 다 보이게 맞춤 (칩을 바꿨을 때) */
  fitKey: string
  /** 모바일에서 아래 시트가 가리는 높이(px). 지도를 맞출 때 그만큼 위로 */
  bottomInset: number
  className?: string
  /** 홈 카드처럼 보기만 하는 지도: 끌기 · 확대 · 키보드 조작을 막아 화면 스크롤을 방해하지 않게 함 */
  readOnly?: boolean
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** 움직이는 동네 지도 (Leaflet + OpenStreetMap, 색을 조금 빼서 차분하게). 장소마다 동그란 핀, 고른 곳은 크게 + 이름표. 🏠 = 우리 집 */
export function LeafletMap({ places, selectedId, onSelect, focus, fitKey, bottomInset, className, readOnly = false }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef<L.LayerGroup | null>(null)
  const latest = useRef({ onSelect, places, bottomInset })
  useEffect(() => {
    latest.current = { onSelect, places, bottomInset }
  })

  useEffect(() => {
    const box = el.current
    if (!box) return
    const m = L.map(box, {
      zoomControl: false,
      attributionControl: true,
      ...(readOnly ? { dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false } : {}),
    }).setView([HOME.lat, HOME.lon], 16)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(m)
    if (!readOnly) L.control.zoom({ position: 'bottomright', zoomInTitle: '크게', zoomOutTitle: '작게' }).addTo(m)
    L.marker([HOME.lat, HOME.lon], { icon: L.divIcon({ className: 'zip-home', html: '<span>🏠</span>', iconSize: [34, 34] }), interactive: false, zIndexOffset: -100 }).addTo(m)
    pins.current = L.layerGroup().addTo(m)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(box)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  // 핀 다시 그리기
  useEffect(() => {
    const g = pins.current
    if (!g) return
    g.clearLayers()
    for (const p of places) {
      const on = p.id === selectedId
      const size = on ? 42 : 32
      const icon = L.divIcon({
        className: on ? 'zip-pin on' : 'zip-pin',
        html: `<span>${CAT_ICON[p.cat] ?? '📍'}</span>${on ? `<b>${esc(p.n)}</b>` : ''}`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
      L.marker([p.lat, p.lon], { icon, title: p.n, zIndexOffset: on ? 1000 : 0 })
        .on('click', () => latest.current.onSelect(p.id))
        .addTo(g)
    }
  }, [places, selectedId])

  // 칩을 바꾸면 그 장소들 + 집이 다 보이게
  useEffect(() => {
    const m = map.current
    const list = latest.current.places
    if (!m) return
    const bounds = L.latLngBounds([[HOME.lat, HOME.lon]])
    for (const p of list) bounds.extend([p.lat, p.lon])
    m.fitBounds(bounds, { paddingTopLeft: [40, 150], paddingBottomRight: [40, latest.current.bottomInset + 30], maxZoom: 17 })
  }, [fitKey])

  // 장소를 고르면 그곳으로 (아래 시트에 가리지 않게 조금 위로)
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    const zoom = Math.max(m.getZoom(), 17)
    const pt = m.project([focus.lat, focus.lon], zoom).add([0, latest.current.bottomInset / 2])
    m.flyTo(m.unproject(pt, zoom), zoom, { duration: 0.5 })
  }, [focus])

  return <div ref={el} className={className} />
}
