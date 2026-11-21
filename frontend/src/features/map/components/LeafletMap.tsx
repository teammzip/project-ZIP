import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { HOME, type PlaceItem } from '../data/places'
import type { NearbyMapResult } from '../nearbyMap'
import { placeColors, placeIconSvg } from '../placeIcons'

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
  searchOrigin?: NearbyMapResult['origin']
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** 움직이는 동네 지도 (Leaflet + OpenStreetMap, 색을 조금 빼서 차분하게). 장소마다 동그란 핀, 고른 곳은 크게 + 이름표. 🏠 = 우리 집 */
export function LeafletMap({ places, selectedId, onSelect, focus, fitKey, bottomInset, className, readOnly = false, viewport, currentPosition, searchOrigin }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef<L.LayerGroup | null>(null)
  const viewLat = viewport?.lat
  const viewLon = viewport?.lon
  const viewZoom = viewport?.zoom
  const markedPoint = searchOrigin?.point ?? currentPosition
  const currentLat = markedPoint?.lat
  const currentLon = markedPoint?.lon
  const markerLabel = searchOrigin?.label ?? '내 위치'
  const searchInset = searchOrigin ? bottomInset : 0
  const latest = useRef({ onSelect, places, bottomInset, viewport, readOnly, selectedId, searchOrigin })
  useEffect(() => {
    latest.current = { onSelect, places, bottomInset, viewport, readOnly, selectedId, searchOrigin }
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
      } else if (latest.current.searchOrigin && !latest.current.selectedId) {
        fitPlaces(m, latest.current)
      }
    })
    ro.observe(box)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  // 핀: 장소 목록 내용(번호 · 위치 · 종류 · 이름)이 바뀔 때만 새로 만들고, 고른 핀이 바뀌면 이전 핀 · 새 핀 두 개의 모양만 바꿈.
  // (예전에는 고를 때마다 누른 핀까지 지우고 새로 만들어 지도가 떨려 보였음)
  const pinKey = places.map((p) => `${p.id}|${p.lat}|${p.lon}|${p.cat}|${p.n}`).join(';')
  const markers = useRef(new Map<string, { marker: L.Marker; place: PlaceItem }>())
  const shownSelected = useRef<string | null>(null)
  useEffect(() => {
    const g = pins.current
    if (!g) return
    g.clearLayers()
    markers.current.clear()
    const chosen = latest.current.selectedId
    for (const p of latest.current.places) {
      const marker = L.marker([p.lat, p.lon], { icon: pinIcon(p, p.id === chosen), title: p.n, zIndexOffset: p.id === chosen ? 1000 : 0 })
        .on('click', () => latest.current.onSelect(p.id))
        .addTo(g)
      markers.current.set(p.id, { marker, place: p })
    }
    shownSelected.current = chosen
  }, [pinKey])
  useEffect(() => {
    const before = shownSelected.current
    if (before === selectedId) return
    for (const [id, on] of [[before, false], [selectedId, true]] as const) {
      const item = id ? markers.current.get(id) : undefined
      if (!item) continue
      item.marker.setIcon(pinIcon(item.place, on))
      item.marker.setZIndexOffset(on ? 1000 : 0)
    }
    shownSelected.current = selectedId
  }, [selectedId])

  // 고정 화면(viewport)이 있으면 그 위치로. 장소를 골라 viewport 가 없어지는 것만으로는 아무것도 안 함
  // (예전에는 여기서 "모든 핀이 보이게"가 같이 돌아, 고른 핀으로 가는 flyTo 와 서로 당기며 지도가 떨렸음)
  useEffect(() => {
    const m = map.current
    if (!m || viewLat === undefined || viewLon === undefined || viewZoom === undefined) return
    const point = m.project([viewLat, viewLon], viewZoom).add([0, bottomInset / 2])
    m.setView(m.unproject(point, viewZoom), viewZoom, { animate: false })
  }, [viewLat, viewLon, viewZoom, bottomInset])

  // 칩 · 탭 · 조건을 바꿨을 때(fitKey)만: 그 장소들이 다 보이게. 고정 화면이 있으면 그쪽이 우선
  useEffect(() => {
    const m = map.current
    const view = latest.current
    if (!m || view.viewport || (view.searchOrigin && view.selectedId)) return
    fitPlaces(m, view)
  }, [fitKey, searchInset])

  useEffect(() => {
    const m = map.current
    if (!m || currentLat === undefined || currentLon === undefined) return
    const marker = L.circleMarker([currentLat, currentLon], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#2f80ed' /* --color-primary (SVG 속성이라 CSS 변수를 못 씀) */, fillOpacity: 1, interactive: false,
    }).bindTooltip(markerLabel, { permanent: true, direction: 'top', offset: [0, -10] }).addTo(m)
    return () => { marker.remove() }
  }, [currentLat, currentLon, markerLabel])

  // 장소를 고르면 그곳으로 (아래 시트에 가리지 않게 조금 위로)
  useEffect(() => {
    const m = map.current
    if (!m || !focus) return
    const zoom = Math.max(m.getZoom(), 17)
    const target = m.unproject(m.project([focus.lat, focus.lon], zoom).add([0, bottomInset / 2]), zoom)
    // flyTo 는 가까운 곳도 살짝 축소했다 확대하는 곡선이라 출렁여 보여서 쓰지 않음
    if (zoom === m.getZoom()) m.panTo(target, { animate: true, duration: 0.35 })
    else m.setView(target, zoom, { animate: true })
  }, [focus, bottomInset])

  return <div ref={el} className={className} />
}

function fitPlaces(map: L.Map, { places, bottomInset, searchOrigin }: Pick<Props, 'places' | 'bottomInset' | 'searchOrigin'>) {
  if (!places.length) return
  const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lon] as [number, number]))
  if (searchOrigin) bounds.extend([searchOrigin.point.lat, searchOrigin.point.lon])
  const top = searchOrigin ? Math.min(150, Math.max(64, (map.getSize().y - bottomInset) * 0.32)) : 150
  map.fitBounds(bounds, { paddingTopLeft: [40, top], paddingBottomRight: [40, bottomInset + 30], maxZoom: 17 })
}

/** 장소 핀 아이콘: 종류 선 아이콘(종류 색), 고른 핀은 크게 + 이름표 */
function pinIcon(p: PlaceItem, on: boolean) {
  const size = on ? 42 : 32
  return L.divIcon({
    className: on ? 'zip-pin on' : 'zip-pin',
    html: `<span style="color:${placeColors(p.cat).fg}">${placeIconSvg(p.cat, on ? 22 : 17)}</span>${on ? `<b>${esc(p.n)}</b>` : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
