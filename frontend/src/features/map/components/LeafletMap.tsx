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
  /** 홈 미리보기처럼 장소 전체 맞춤 대신 지정한 중심·확대 수준을 유지 */
  viewport?: { lat: number; lon: number; zoom: number }
  /** 브라우저에서 확인한 실제 현재 위치. 예시 집 위치와 구분해서 표시 */
  currentPosition?: { lat: number; lon: number } | null
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** 움직이는 동네 지도 (Leaflet + OpenStreetMap, 색을 조금 빼서 차분하게). 장소마다 동그란 핀, 고른 곳은 크게 + 이름표. 🏠 = 우리 집 */
export function LeafletMap({ places, selectedId, onSelect, focus, fitKey, bottomInset, className, readOnly = false, viewport, currentPosition }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef<L.LayerGroup | null>(null)
  const viewLat = viewport?.lat
  const viewLon = viewport?.lon
  const viewZoom = viewport?.zoom
  const currentLat = currentPosition?.lat
  const currentLon = currentPosition?.lon
  const latest = useRef({ onSelect, places, bottomInset, viewport, readOnly })
  useEffect(() => {
    latest.current = { onSelect, places, bottomInset, viewport, readOnly }
  })

  useEffect(() => {
    const box = el.current
    if (!box) return
    const initialReadOnly = latest.current.readOnly
    const m = L.map(box, {
      zoomControl: false,
      attributionControl: true,
      ...(initialReadOnly ? { dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false } : {}),
    }).setView([latest.current.viewport?.lat ?? HOME.lat, latest.current.viewport?.lon ?? HOME.lon], latest.current.viewport?.zoom ?? 16)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(m)
    if (!initialReadOnly) L.control.zoom({ position: 'bottomright', zoomInTitle: '크게', zoomOutTitle: '작게' }).addTo(m)
    pins.current = L.layerGroup().addTo(m)
    map.current = m
    const ro = new ResizeObserver(() => {
      m.invalidateSize()
      const view = latest.current.viewport
      if (view) {
        const point = m.project([view.lat, view.lon], view.zoom).add([0, latest.current.bottomInset / 2])
        m.setView(m.unproject(point, view.zoom), view.zoom, { animate: false })
      }
    })
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

  // 홈은 현재 위치 주변을 고정. 큰 지도는 칩을 바꾸면 그 장소들 + 집이 다 보이게.
  useEffect(() => {
    const m = map.current
    const list = latest.current.places
    if (!m) return
    if (viewLat !== undefined && viewLon !== undefined && viewZoom !== undefined) {
      const point = m.project([viewLat, viewLon], viewZoom).add([0, bottomInset / 2])
      m.setView(m.unproject(point, viewZoom), viewZoom, { animate: false })
      return
    }
    const bounds = L.latLngBounds([[HOME.lat, HOME.lon]])
    for (const p of list) bounds.extend([p.lat, p.lon])
    m.fitBounds(bounds, { paddingTopLeft: [40, 150], paddingBottomRight: [40, latest.current.bottomInset + 30], maxZoom: 17 })
  }, [fitKey, viewLat, viewLon, viewZoom, bottomInset])

  useEffect(() => {
    const m = map.current
    if (!m || currentLat === undefined || currentLon === undefined) return
    const marker = L.circleMarker([currentLat, currentLon], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false,
    }).bindTooltip('내 위치', { permanent: true, direction: 'top', offset: [0, -10] }).addTo(m)
    return () => { marker.remove() }
  }, [currentLat, currentLon])

  // 장소를 고르면 그곳으로 (아래 시트에 가리지 않게 조금 위로)
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    const zoom = Math.max(m.getZoom(), 17)
    const pt = m.project([focus.lat, focus.lon], zoom).add([0, bottomInset / 2])
    m.flyTo(m.unproject(pt, zoom), zoom, { duration: 0.5 })
  }, [focus, bottomInset])

  return <div ref={el} className={className} />
}
