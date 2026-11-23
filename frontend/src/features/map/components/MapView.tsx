import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { RegionVerifyDialog, useRegionVerify } from '@/features/life'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { aiFind } from '../aiFind'
import { mapApi, usePlaceNotice } from '../api'
import { walkMin, type PlaceItem } from '../data/places'
import { getKakaoPlaceId, isKakaoPlace } from '../kakaoPlaceId'
import type { NearbyMapResult } from '../nearbyMap'
import { placeColors } from '../placeIcons'
import { PlaceIcon } from './PlaceIcon'
import { PlaceReviews, RatingBadge } from './PlaceReviews'
import { useReviewSummaries, type ReviewSummary } from '../reviews'
import { SaveSheet } from './SaveSheet'
import { openSaveSheet, useFavNote } from '../saveSheet'
import { useMapStore } from '../store'
import { useMapData, useMapServerSync } from '../useMapData'
import { useNeighborhoodPosition } from '../useNeighborhoodPosition'
import styles from './MapView.module.css'

// 지도 라이브러리(Leaflet)는 크기가 커서 이 화면에 들어올 때만 받아 옴
const LeafletMap = lazy(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })))

const CUSTOM = 'c:' // 직접 추가한 검색어 칩 앞머리 ("c:카페")
const ALL = '' // 종류를 고르지 않음 = 주변 장소 전체 (처음 들어왔을 때)
const AI_EXAMPLES = ['24시간 편의점', '조용한 카페', '혼밥 저렴한 식당', '이불 빨래할 곳']

/** 목록 위 조건 칩 (장소 설명에 그 말이 있으면 남김) */
const FILTERS: Array<{ key: string; label: string; re?: RegExp }> = [
  { key: 'near', label: '가까운 순' },
  { key: '24', label: '24시간', re: /24시간|심야|야간/ },
  { key: 'cheap', label: '저렴한', re: /저렴|월 3만원/ },
  { key: 'quiet', label: '조용한', re: /조용|스터디/ },
]

/* 카카오맵 링크 (https://apis.map.kakao.com/web/guide/#bigmapurl). 카카오 장소는 장소 id 로 열어 영업시간 · 사진 · 후기까지 보임 */
const kakaoPoint = (p: PlaceItem) => `${encodeURIComponent(p.n.replace(/,/g, ' '))},${p.lat},${p.lon}`
const bigUrl = (p: PlaceItem) => {
  const id = getKakaoPlaceId(p.id)
  return id ? `https://place.map.kakao.com/${id}` : `https://map.kakao.com/link/map/${kakaoPoint(p)}`
}
/** 출발지는 카카오맵이 정함 (현재 위치 · 직접 입력) */
const routeUrl = (p: PlaceItem) => `https://map.kakao.com/link/to/${getKakaoPlaceId(p.id) ?? kakaoPoint(p)}`
const walkText = (p: PlaceItem) => (walkMin(p) < 99 ? `도보 ${walkMin(p)}분` : '거리 정보 없음')
/** 설명에서 "도보 약 N분"을 뺀 특징들 */
const tagsOf = (p: PlaceItem) =>
  p.d
    .split('·')
    .map((t) => t.trim())
    .filter((t) => t && !/도보/.test(t))
/** 종류마다 정해진 연한 배경 (썸네일) */
const MOBILE = '(max-width: 900px)'
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useMobile = () => useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE).matches)

/** named: 가게 이름 · 검색어로 찾은 결과가 있음 (카카오 키워드 검색) */
type Found = { q: string; items: Array<{ p: PlaceItem; why: string[] }>; named: boolean; failed: boolean }

/** 동네 지도 (네이버 지도처럼)
 * - 모바일: 화면 가득 지도 + 위에 검색창 · 종류 칩, 오른쪽 둥근 버튼(저장 · 내 위치), 아래 끌어올리는 시트(동네 · 저장 탭, 장소 목록)
 * - PC: 왼쪽 목록 칸(검색 · 탭 · 목록 · 상세) + 오른쪽 넓은 지도(위에 종류 칩)
 * - 검색은 장소 이름 + AI 장소 찾기("밤에 갈 수 있는 약국" → 가까운 순 추천 + 이유, 시연용)
 * - 처음엔 종류를 고르지 않은 "전체"(주변 장소 모두), ?cat=세탁방 으로 열면 그 종류부터
 * - ★ 저장(즐겨찾기), 종류 편집(켜기 · 끄기 · 직접 검색어) */
export function MapView({ initialNearby = null }: { initialNearby?: NearbyMapResult | null }) {
  const { on, custom, favs, favNames, lists, ensureCat, toggleCat } = useMapStore()
  const position = useNeighborhoodPosition()
  const [nearby, setNearby] = useState(initialNearby)
  const data = useMapData(nearby ? null : position.point)
  const placeNotice = usePlaceNotice((s) => s.notice)
  const favNote = useFavNote((s) => s.note)
  const chipsRef = useRef<HTMLDivElement>(null)
  // ⋯ 전체 종류 창: 바깥을 누르거나 Esc 면 닫힘
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: globalThis.PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])
  const chipScroll = useHorizontalScroll(chipsRef, `${on.join()}|${custom.join()}`)
  const places = data.places
  useMapServerSync()
  const mobile = useMobile()
  const [params] = useSearchParams()
  const region = position.region
  const { verified } = useRegionVerify()
  const [verifyOpen, setVerifyOpen] = useState(false)
  const currentPoint = position.verifiedPoint
  const mapPoint = nearby?.origin.point ?? position.point
  const locationKey = `${region}|${position.source}|${position.point?.lat}|${position.point?.lon}|${position.verifiedAt}`
  const selectionKey = nearby ? 'nearby' : locationKey
  const asked = params.get('cat')
  // 서버 모드는 종류 목록을 받기 전이라 비어 있을 수 있어서, 그때는 주소의 종류를 그대로 믿음 (아래에서 칩에도 켬)
  const [cat, setCat] = useState(() => (asked && (data.kinds.includes(asked) || !data.kinds.length) ? asked : ALL))
  const [tab, setTab] = useState<'near' | 'fav'>('near')
  const [filter, setFilter] = useState('near')
  const [selId, setSelId] = useState<string | null>(null)
  const [selectedLocationKey, setSelectedLocationKey] = useState('')
  const [query, setQuery] = useState(initialNearby?.query ?? '')
  const [mapSearch, setFound] = useState<Found | null>(null)
  const [searching, setSearching] = useState(false)
  const searchRequest = useRef<AbortController | null>(null)
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<'peek' | 'full'>('peek')
  const [focus, setFocus] = useState<{ lat: number; lon: number; n: number } | null>(null)
  const [centerRequest, setCenterRequest] = useState(0)
  const drag = useRef<number | null>(null)

  useEffect(() => {
    setFound(null)
    setSearching(false)
    return () => searchRequest.current?.abort()
  }, [locationKey])

  // 주소로 받은 종류가 꺼져 있으면 칩에 켬
  useEffect(() => {
    if (asked) ensureCat(asked)
  }, [asked, ensureCat])

  const found: Found | null = nearby
    ? { q: nearby.query, items: nearby.places.map((p) => ({ p, why: [] })), named: true, failed: false }
    : mapSearch
  const distances = new Map(nearby?.places.map((p) => [p.id, p.distanceMeters]))
  const base = (() => {
    if (found) return found.items.map((r) => r.p)
    if (tab === 'fav') return places.filter((p) => favs.includes(p.id))
    if (cat === ALL) return places
    if (cat.startsWith(CUSTOM)) {
      const kw = cat.slice(CUSTOM.length)
      return places.filter((p) => (p.n + p.d + p.cat).includes(kw))
    }
    return places.filter((p) => p.cat === cat)
  })()
  const rule = FILTERS.find((f) => f.key === filter)?.re
  const list = (found ? base : [...base].sort((a, b) => walkMin(a) - walkMin(b))).filter((p) => !rule || rule.test(p.d))
  // 저장 탭: 지금 불러온 장소에 없는 카카오 저장 장소 (좌표를 저장하지 않아 지도 핀 없이 목록으로만)
  const savedKakao = tab === 'fav' && !found
    ? favs.flatMap((id) => {
      const kakaoId = getKakaoPlaceId(id)
      return kakaoId && favNames[id] && !list.some((p) => p.id === id) ? [{ id, kakaoId, ...favNames[id] }] : []
    })
    : []
  // 목록 별점 (ZIP 회원 리뷰 평균 · 수)
  const summaries = useReviewSummaries([...list.map((p) => p.id), ...savedKakao.map((k) => k.id)])
  const activeSelectedId = selectedLocationKey === selectionKey ? selId : null
  // 검색 결과는 불러온 목록에 없을 수 있어서 함께 찾음
  const pool = found ? [...found.items.map((r) => r.p), ...places] : places
  const selected = activeSelectedId ? pool.find((p) => p.id === activeSelectedId) : undefined
  // 지도에는 목록 + (목록에 없으면) 고른 곳
  const pins = selected && !list.some((p) => p.id === selected.id) ? [...list, selected] : list
  const fitKey = `${found?.q ?? ''}|${tab}|${cat}|${filter}|${centerRequest}`
  const place = region.split(' ').slice(1).join(' ') || region || '우리 동네'
  const bottomInset = mobile && sheet === 'peek' ? Math.round(window.innerHeight * 0.4) : 0

  const select = (p: PlaceItem) => {
    setSelectedLocationKey(selectionKey)
    setSelId(p.id)
    setFocus({ lat: p.lat, lon: p.lon, n: Date.now() })
    setSheet('peek')
  }
  const pickCat = (c: string) => {
    setCat(c)
    setTab('near')
    clearSearch()
    setSelId(null)
    setFocus(null)
  }
  const clearSearch = () => {
    searchRequest.current?.abort()
    setSearching(false)
    setFound(null)
    setNearby(null)
    if (nearby) {
      setSelId(null)
      setFocus(null)
    }
  }
  const search = async (q: string) => {
    const text = q.trim()
    clearSearch()
    if (!text) return
    const request = new AbortController()
    searchRequest.current = request
    setSearching(true)
    let items: Found['items'] = []
    let named = false
    let failed = false
    if (data.server && data.regionId) {
      const center = position.point ? { lat: Number(position.point.lat.toFixed(5)), lon: Number(position.point.lon.toFixed(5)) } : {}
      const [keyword, recommendation] = await Promise.allSettled([
        mapApi.places(data.regionId, { q: text, ...center, wide: true }, request.signal),
        mapApi.aiSearch(text, data.regionId, request.signal),
      ])
      if (request.signal.aborted) return
      const byName = keyword.status === 'fulfilled' ? keyword.value : []
      const ai = recommendation.status === 'fulfilled' ? recommendation.value : []
      const matches = new Map(ai.map((item) => [item.p.id, item]))
      const namedItems = byName.map((p) => ({ p, why: matches.get(p.id)?.why ?? [] }))
      const namedIds = new Set(byName.map((p) => p.id))
      items = [...namedItems, ...ai.filter(({ p }) => !namedIds.has(p.id))]
      named = namedItems.length > 0
      failed = keyword.status === 'rejected' || recommendation.status === 'rejected'
    } else if (!data.server) {
      items = aiFind(text).map((r) => ({ p: r.p, why: r.why }))
    } else {
      failed = true
    }
    if (!items.length) {
      items = places.filter((p) => (p.n + p.d + p.cat).includes(text)).map((p) => ({ p, why: [`"${text}" 포함`] }))
      named = items.length > 0
    }
    setQuery(text)
    setFound({ q: text, items, named, failed })
    setSearching(false)
    setFilter('near')
    setSelId(null)
    setFocus(null)
    setSheet('peek')
  }
  const resetFocus = () => {
    setSelId(null)
    setFocus(null)
    if (nearby) {
      setSheet('peek')
      setCenterRequest((value) => value + 1)
    }
  }

  // 시트 손잡이: 위로 끌면 펼치고 아래로 끌면 접기, 누르기만 하면 바꾸기
  const onGrab = (e: PointerEvent) => {
    drag.current = e.clientY
  }
  const onRelease = (e: PointerEvent) => {
    if (drag.current === null) return
    const dy = e.clientY - drag.current
    drag.current = null
    setSheet(Math.abs(dy) < 8 ? (sheet === 'peek' ? 'full' : 'peek') : dy < 0 ? 'full' : 'peek')
  }

  const searchBox = (
    <form
      className={styles.search}
      role="search"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void search(query)
      }}
    >
      <span className={styles.searchPin} aria-hidden="true">
        <PlaceIcon cat="기타" size={20} />
      </span>
      <input value={query} onChange={(e) => {
        if (searching) clearSearch()
        setQuery(e.target.value)
      }} maxLength={40} placeholder="장소 검색 · AI에게 물어보기" aria-label="장소 검색 또는 AI에게 물어보기" type="search" />
      {(found || searching) && (
        <button
          type="button"
          className={styles.searchX}
          onClick={() => {
            setQuery('')
            clearSearch()
          }}
          aria-label="검색 지우기"
        >
          ✕
        </button>
      )}
      <button type="submit" className={styles.searchGo} aria-label="AI로 찾기" title="AI로 찾기">
        ✨
      </button>
    </form>
  )

  return (
    <div className={styles.root} data-sheet={sheet}>
      {/* 지도 */}
      <div className={styles.mapArea}>
        {mapPoint ? <Suspense fallback={<div className={styles.map} />}>
          <LeafletMap
            className={styles.map} places={pins} selectedId={activeSelectedId} onSelect={(id) => select(pool.find((p) => p.id === id)!)}
            focus={activeSelectedId ? focus : null} fitKey={fitKey} bottomInset={bottomInset}
            viewport={!selected && !found && mapPoint ? { ...mapPoint, zoom: 16 } : undefined}
            currentPosition={currentPoint}
            searchOrigin={nearby?.origin}
          />
        </Suspense> : <div className={cx(styles.map, styles.mapLoading)} role="status">
          <p>{position.loading ? '선택한 동네의 지도를 준비하고 있어요.' : position.error}</p>
          {position.error && <Button variant="line" onClick={position.retry}>다시 불러오기</Button>}
        </div>}

        <div className={styles.overlayTop}>
          <div className={styles.mobileOnly}>{searchBox}</div>
          {/* 종류 칩 줄 + 끝의 ⋯ (전체 종류 2열 창) */}
          <div className={styles.chipBar}>
          <div className={cx(styles.chipsWrap, chipScroll.left && styles.fadeLeft, chipScroll.right && styles.fadeRight)}>
          {chipScroll.left && (
            <button type="button" className={cx(styles.chipArrow, styles.chipArrowLeft)} aria-label="종류 칩 왼쪽으로" onClick={() => chipScroll.by(-1)}>
              ‹
            </button>
          )}
          <div ref={chipsRef} className={styles.chips} role="radiogroup" aria-label="장소 종류">
            <Chip color={placeColors('기타').fg} on={!found && tab === 'near' && cat === ALL} onClick={() => pickCat(ALL)}>
              전체
            </Chip>
            {on.map((c) => (
              <Chip key={c} color={placeColors(c).fg} on={!found && tab === 'near' && cat === c} onClick={() => pickCat(c)}>
                <PlaceIcon cat={c} /> {c}
              </Chip>
            ))}
            {custom.map((k) => (
              <Chip key={k} color={placeColors('검색').fg} on={!found && tab === 'near' && cat === CUSTOM + k} onClick={() => pickCat(CUSTOM + k)}>
                <PlaceIcon cat="검색" /> {k}
              </Chip>
            ))}
          </div>
          {chipScroll.right && (
            <button type="button" className={cx(styles.chipArrow, styles.chipArrowRight)} aria-label="종류 칩 오른쪽으로" onClick={() => chipScroll.by(1)}>
              ›
            </button>
          )}
          </div>
          <div ref={moreRef} className={styles.moreWrap}>
            <button type="button" className={cx(styles.moreBtn, moreOpen && styles.moreBtnOn)} aria-label="전체 장소 종류" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
              <span aria-hidden="true">⋯</span>
            </button>
            {moreOpen && (
              <div className={styles.morePanel} role="menu" aria-label="전체 장소 종류">
                <div className={styles.moreGrid}>
                  {data.kinds.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="menuitem"
                      className={cx(styles.moreItem, !found && tab === 'near' && cat === k && styles.moreItemOn)}
                      onClick={() => {
                        if (!on.includes(k)) toggleCat(k) // 칩에 없던 종류는 칩에도 추가
                        pickCat(k)
                        setMoreOpen(false)
                      }}
                    >
                      <span style={{ color: placeColors(k).fg }}><PlaceIcon cat={k} size={20} /></span>
                      {k}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.moreEdit}
                  onClick={() => {
                    setMoreOpen(false)
                    setEditing(true)
                  }}
                >
                  ⚙ 칩 편집 · 검색어 추가
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* 오른쪽 둥근 버튼 */}
        <div className={styles.fabs}>
          <button
            type="button"
            className={cx(styles.fab, tab === 'fav' && !found && styles.fabOn)}
            onClick={() => {
              clearSearch()
              setTab(tab === 'fav' ? 'near' : 'fav')
            }}
            aria-pressed={tab === 'fav'}
            aria-label={`내가 저장한 곳 보기 (${favs.length}곳)`}
            title="내가 저장한 곳 보기"
          >
            ★
            {favs.length > 0 && <span className={styles.fabBadge} aria-hidden="true">{favs.length > 99 ? '99+' : favs.length}</span>}
          </button>
          <button type="button" className={styles.fab} onClick={() => setVerifyOpen(true)} aria-label={verified ? '현 위치 다시 인증' : '현 위치 인증'} title={verified ? '현 위치 다시 인증' : '현 위치 인증'} aria-haspopup="dialog">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2.4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* 목록 칸 (PC 왼쪽 / 모바일 아래 시트) */}
      <section className={styles.panel} aria-label="장소 목록">
        <button type="button" className={styles.grab} onPointerDown={onGrab} onPointerUp={onRelease} aria-label={sheet === 'peek' ? '목록 펼치기' : '목록 접기'}>
          <span />
        </button>
        <div className={styles.pcOnly}>{searchBox}</div>

        <div className={styles.panelScroll}>
          {nearby ? (
            <div className={styles.nearbySummary}>
              <h2>근처 탐색 <span>“{nearby.query}”</span> <small>{nearby.places.length}곳</small></h2>
              <p className={styles.note}>{nearby.origin.label} 기준 · 반경 1km · 가까운 순</p>
              {nearby.checkHours && <p className={styles.note}>영업시간은 카카오맵 상세 화면에서 확인해 주세요.</p>}
              <Button variant="line" onClick={resetFocus}>핀 전체 보기</Button>
            </div>
          ) : <p className={styles.note} role="status">
            {position.loading ? '저장한 동네를 찾고 있어요.' : position.error || `${region} · ${currentPoint ? '파란 점이 인증한 위치예요.' : '선택한 동네 중심을 표시해요. 위치 인증 시 인증한 위치로 변경돼요.'}`}
          </p>}
          {!nearby && data.server && (data.loading || data.error) && (
            <p className={styles.note} role="status">
              {data.loading ? '서버에서 장소를 불러오고 있어요.' : data.error}
            </p>
          )}
          {!nearby && data.server && placeNotice && <p className={styles.note} role="status">{placeNotice}</p>}
          {favNote && (
            <p className={styles.favNote} role="status">
              {favNote}
            </p>
          )}
          {selected ? (
            <PlaceDetail p={selected} distanceMeters={distances.get(selected.id)} onBack={resetFocus} />
          ) : (
            <>
              {!nearby && <div className={styles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'near' && !found}
                  className={cx(styles.tab, tab === 'near' && !found && styles.tabOn)}
                  onClick={() => {
                    clearSearch()
                    setTab('near')
                  }}
                >
                  <PlaceIcon cat="기타" size={16} /> {place.split(' ').at(-1)} 주변
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'fav' && !found}
                  className={cx(styles.tab, tab === 'fav' && !found && styles.tabOn)}
                  onClick={() => {
                    clearSearch()
                    setTab('fav')
                  }}
                >
                  <i aria-hidden="true">★</i> 내가 저장한 곳 <b className={styles.tabCount}>{favs.length}</b>
                </button>
              </div>}

              {!nearby && <h2 className={styles.listTitle}>
                {found ? (
                  <>
                    <span className={styles.ai}>{found.named ? '🔎 검색 결과' : '✨ AI 추천'}</span> &ldquo;{found.q}&rdquo;
                  </>
                ) : tab === 'fav' ? (
                  '내가 저장한 곳'
                ) : (
                  <>이 주변 {cat === ALL ? '장소' : cat.startsWith(CUSTOM) ? cat.slice(CUSTOM.length) : cat}</>
                )}
                <small>{list.length + savedKakao.length}곳</small>
              </h2>}

              {!found && tab === 'near' && (
                <div className={styles.filters}>
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" className={cx(styles.filter, filter === f.key && styles.filterOn)} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {searching && <p className={styles.empty} role="status">장소를 찾고 있어요.</p>}
              {found?.failed && <p className={styles.empty} role="status">{found.items.length ? '일부 검색 결과를 불러오지 못했어요.' : '장소 검색에 실패했어요. 잠시 후 다시 시도해 주세요.'}</p>}
              {found && !found.failed && !found.items.length && <p className={styles.empty}>&ldquo;{found.q}&rdquo;에 맞는 곳을 못 찾았어요. 다른 말로 물어보거나 ⚙ 편집에서 종류를 추가해 보세요.</p>}
              {!found && tab === 'near' && (
                <div ref={dragScroll} className={styles.examples}>
                  <span className={styles.examplesLabel}>✨ AI에게</span>
                  {AI_EXAMPLES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQuery(q)
                        void search(q)
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {tab === 'fav' && !found ? (
                // 내가 저장한 곳: 내가 만든 리스트별로 세로로 (리스트 제목 → 그 리스트 장소들). 한 장소가 여러 리스트에 보일 수 있음
                (lists.length ? lists : [{ id: 'all', name: '내 장소', color: '#03c75a', placeIds: favs }]).map((l) => {
                  const ids = l.placeIds.filter((id) => favs.includes(id))
                  const rows = list.filter((p) => ids.includes(p.id))
                  const kakaoRows = savedKakao.filter((k) => ids.includes(k.id))
                  if (!rows.length && !kakaoRows.length) return null
                  return (
                    <section key={l.id} className={styles.favGroup} aria-label={`${l.name} ${ids.length}곳`}>
                      <h3 className={styles.favGroupTitle}>
                        <span className={styles.listStar} style={{ background: l.color }} aria-hidden="true">
                          ★
                        </span>
                        {l.name}
                        <small>{ids.length}</small>
                      </h3>
                      <ol className={styles.list}>
                        {rows.map((p, i) => (
                          <PlaceRow key={p.id} p={p} rank={i + 1} summary={summaries.get(p.id)} onClick={() => select(p)} />
                        ))}
                        {kakaoRows.map((k) => (
                          <SavedKakaoRow key={k.id} {...k} summary={summaries.get(k.id)} />
                        ))}
                      </ol>
                    </section>
                  )
                })
              ) : (
                <ol className={styles.list}>
                  {list.map((p, i) => (
                    <PlaceRow key={p.id} p={p} rank={i + 1} why={found?.items.find((r) => r.p.id === p.id)?.why} distanceMeters={distances.get(p.id)} summary={summaries.get(p.id)} onClick={() => select(p)} />
                  ))}
                </ol>
              )}
              {!found && !list.length && !savedKakao.length && <p className={styles.empty}>{tab === 'fav' ? '아직 저장한 곳이 없어요. 장소 오른쪽의 [☆ 저장]을 누르면 여기에 모여요.' : data.server ? '이 조건의 장소가 아직 없어요.' : '이 조건의 장소가 예시 데이터에 없어요.'}</p>}
              <p className={styles.note}>{!data.server ? '장소는 예시 데이터예요.' : list.some((p) => isKakaoPlace(p.id)) || savedKakao.length ? '장소 검색 © Kakao.' : '장소는 서버(DB)에서 불러왔어요.'} 지도 © OpenStreetMap</p>
            </>
          )}
        </div>
      </section>

      <RegionVerifyDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} onVerified={() => {
        if (nearby) clearSearch()
        setSelId(null)
        setFocus(null)
        setSheet('peek')
        setCenterRequest((value) => value + 1)
      }} />
      <SaveSheet />
      <Modal open={editing} onClose={() => setEditing(false)} title="장소 종류 편집">
        <h3 className={styles.editTitle}>장소 종류 편집</h3>
        <CategoryEditor kinds={data.kinds} places={places} current={cat} onCurrentGone={(next) => pickCat(next)} onAdded={(k) => pickCat(CUSTOM + k)} />
      </Modal>
    </div>
  )
}

function Chip({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={cx(styles.chip, on && styles.chipOn)} style={{ '--chip': color } as CSSProperties} onClick={onClick}>
      {children}
    </button>
  )
}

/** ☆ / ★ 저장 버튼 */
function FavStar({ p, big }: { p: PlaceItem; big?: boolean }) {
  const fav = useMapStore((s) => s.favs.includes(p.id))
  return (
    <button
      type="button"
      className={cx(big ? styles.star : styles.saveBtn, fav && (big ? styles.starOn : styles.saveBtnOn), big && styles.starBig)}
      aria-label={fav ? `${p.n} 저장한 리스트 바꾸기` : `${p.n} 리스트에 저장`}
      aria-pressed={fav}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        // 저장 창에서 리스트를 골라 저장 (카카오 장소는 이름 · 종류만 서버에 — 주소 · 좌표는 저장 안 함)
        openSaveSheet({ id: p.id, n: p.n, cat: p.cat })
      }}
    >
      <ActionIcon name="star" filled={fav} />
      <span>{fav ? '저장됨' : '저장'}</span>
    </button>
  )
}

/** 지도 화면 버튼 아이콘 (선 아이콘, 색은 글자색 currentColor 를 따름) */
function ActionIcon({ name, filled }: { name: 'star' | 'route' | 'info' | 'map'; filled?: boolean }) {
  return (
    <svg className={styles.actionIcon} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'}>
      {name === 'star' && <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />}
      {name === 'route' && <path d="M20.5 3.5L3.5 10.6l7 2.9 2.9 7z" />}
      {name === 'info' && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5M12 7.6v.1" />
        </>
      )}
      {name === 'map' && <path d="M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2zM9 4.5v13M15 6.5v13" />}
    </svg>
  )
}

/** 목록 한 줄: 왼쪽 썸네일, 순위 · 이름 · 종류 · 도보, 특징 칩 (AI 추천이면 추천 이유) */
function PlaceRow({ p, rank, why, distanceMeters, summary, onClick }: { p: PlaceItem; rank: number; why?: string[]; distanceMeters?: number; summary?: ReviewSummary; onClick: () => void }) {
  return (
    <li>
      <div className={styles.row} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
        <span className={styles.thumb} style={{ background: placeColors(p.cat).bg, color: placeColors(p.cat).fg }} aria-hidden="true">
          <PlaceIcon cat={p.cat} size={30} />
        </span>
        <span className={styles.rowMain}>
          <span className={styles.rowName}>
            <i>{rank}</i>
            <b>{p.n}</b>
            {summary && <RatingBadge rating={summary.rating} count={summary.count} />}
          </span>
          <small>
            {p.cat} · {distanceMeters === undefined ? walkText(p) : `직선 ${distanceMeters.toLocaleString('ko-KR')}m`}
          </small>
          <span className={styles.rowTag}>{why?.length ? `추천 이유: ${why.join(' · ')}` : tagsOf(p).join(' · ') || '동네 장소'}</span>
        </span>
        <FavStar p={p} />
      </div>
    </li>
  )
}

/** 가로로 넘치는 줄: 마우스 휠(세로)로도 옆으로 움직이고, 양쪽에 더 있는지 알려 줌 (‹ › 버튼 · 끝 흐림용).
 * PC 마우스는 가로 스크롤을 못 해서 필요해요. key 가 바뀌면(칩 추가 · 삭제) 다시 잼 */
function useHorizontalScroll(ref: React.RefObject<HTMLDivElement | null>, key: string) {
  const [edges, setEdges] = useState({ left: false, right: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // 값이 바뀔 때만 다시 그림 (같은 값이면 이전 객체 그대로)
    const update = () => {
      const left = el.scrollLeft > 2, right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault() // 지도 확대 · 페이지 스크롤 대신 칩을 옆으로
      el.scrollLeft += e.deltaY
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      el.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [ref, key])
  const by = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' })
  return { ...edges, by }
}

/** 가로로 넘치는 줄에 붙이는 ref: 마우스 휠(세로)로 옆으로, PC 에서는 끌어서도 옆으로.
 * 끌었을 때는 버튼 클릭으로 치지 않음. 줄이 다시 그려질 때마다 새로 붙고 사라지면 떼어 냄 (React 19 ref 정리) */
function dragScroll(el: HTMLDivElement | null) {
  if (!el) return
  let startX = 0
  let startLeft = 0
  let dragging = false
  let moved = false
  const onWheel = (e: WheelEvent) => {
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }
  const onDown = (e: globalThis.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return // 손가락은 원래대로 밀기
    dragging = true
    moved = false
    startX = e.clientX
    startLeft = el.scrollLeft
  }
  const onMove = (e: globalThis.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - startX
    if (Math.abs(dx) > 4) moved = true
    if (moved) el.scrollLeft = startLeft - dx
  }
  const onUp = () => {
    dragging = false
  }
  const onClick = (e: globalThis.MouseEvent) => {
    if (moved) {
      e.preventDefault()
      e.stopPropagation()
      moved = false
    }
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  el.addEventListener('click', onClick, true)
  return () => {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    el.removeEventListener('click', onClick, true)
  }
}

/** 저장 탭의 카카오 장소 (이름 · 종류만 있음): 누르면 카카오맵 장소 페이지, ★ 로 저장 취소 */
function SavedKakaoRow({ id, kakaoId, n, cat, summary }: { id: string; kakaoId: string; n: string; cat: string; summary?: ReviewSummary }) {
  return (
    <li>
      <div className={styles.row}>
        <a className={styles.rowLink} href={`https://place.map.kakao.com/${kakaoId}`} target="_blank" rel="noopener noreferrer">
          <span className={styles.thumb} style={{ background: placeColors(cat).bg, color: placeColors(cat).fg }} aria-hidden="true">
            <PlaceIcon cat={cat} size={30} />
          </span>
          <span className={styles.rowMain}>
            <span className={styles.rowName}>
              <b>{n}</b>
              {summary && <RatingBadge rating={summary.rating} count={summary.count} />}
            </span>
            <small>{cat} · 카카오맵에서 보기 ↗</small>
          </span>
        </a>
        <button
          type="button"
          className={cx(styles.saveBtn, styles.saveBtnOn)}
          aria-label={`${n} 저장한 리스트 바꾸기`}
          aria-pressed
          onClick={() => openSaveSheet({ id, n, cat })}
        >
          <ActionIcon name="star" filled />
          <span>저장됨</span>
        </button>
      </div>
    </li>
  )
}

/** 장소 상세: 이름 · 종류 · 도보, 특징, 저장 · 길찾기 · 큰 지도, 리뷰 */
function PlaceDetail({ p, distanceMeters, onBack }: { p: PlaceItem; distanceMeters?: number; onBack: () => void }) {
  return (
    <div className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        ‹ 목록
      </button>
      <div className={styles.detailHead}>
        <span className={styles.thumbBig} style={{ background: placeColors(p.cat).bg, color: placeColors(p.cat).fg }} aria-hidden="true">
          <PlaceIcon cat={p.cat} size={36} />
        </span>
        <div>
          <h2>{p.n}</h2>
          <small>
            {p.cat} · {distanceMeters === undefined ? `🏠 우리 집에서 ${walkText(p)}` : `직선 ${distanceMeters.toLocaleString('ko-KR')}m`}
          </small>
        </div>
      </div>
      <div className={styles.tags}>
        {tagsOf(p).map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className={styles.actions}>
        <FavStar p={p} big />
        <a className={styles.action} href={routeUrl(p)} target="_blank" rel="noopener noreferrer">
          <ActionIcon name="route" />
          <span>길찾기</span>
        </a>
        <a className={styles.action} href={bigUrl(p)} target="_blank" rel="noopener noreferrer">
          {/* 카카오 장소: 카카오맵 장소 페이지(영업시간 · 사진 · 후기), DB 장소: 카카오맵에서 위치 보기 */}
          <ActionIcon name={isKakaoPlace(p.id) ? 'info' : 'map'} />
          <span>{isKakaoPlace(p.id) ? '더 알아보기' : '큰 지도'}</span>
        </a>
      </div>
      <PlaceReviews placeId={p.id} placeName={p.n} />
    </div>
  )
}

/** 종류 편집: 종류 켜기·끄기, 직접 검색어 추가·삭제, 기본값으로 되돌리기 */
function CategoryEditor({ kinds, places, current, onCurrentGone, onAdded }: { kinds: string[]; places: PlaceItem[]; current: string; onCurrentGone: (next: string) => void; onAdded: (kw: string) => void }) {
  const { on, custom, toggleCat, addCustom, removeCustom, resetCats } = useMapStore()
  const [kw, setKw] = useState('')

  return (
    <div className={styles.editor}>
      <p className={common.note}>지도 위 칩에 보일 장소 종류를 눌러 켜고 끄세요. (✓ = 지금 보이는 종류)</p>
      <div className={common.chips}>
        {kinds.map((c) => {
          const isOn = on.includes(c)
          return (
            <button
              key={c}
              type="button"
              className={cx(common.chip, isOn && common.chipOn)}
              aria-pressed={isOn}
              onClick={() => {
                toggleCat(c)
                if (isOn && current === c) onCurrentGone(ALL)
              }}
            >
              {isOn && '✓ '}
              <PlaceIcon cat={c} /> {c} {places.filter((p) => p.cat === c).length}
            </button>
          )
        })}
      </div>
      <form
        className={styles.catAdd}
        onSubmit={(e) => {
          e.preventDefault()
          const k = kw.trim()
          if (addCustom(k)) onAdded(k)
          setKw('')
        }}
      >
        <input value={kw} onChange={(e) => setKw(e.target.value)} maxLength={12} placeholder="직접 추가 (예: 빵집, 고시원)" aria-label="직접 추가할 검색어" />
        <Button type="submit" variant="line">
          추가
        </Button>
      </form>
      {custom.length > 0 && (
        <div className={common.chips}>
          {custom.map((k) => (
            <button
              key={k}
              type="button"
              className={common.chip}
              title="이 검색어 칩 지우기"
              onClick={() => {
                removeCustom(k)
                if (current === CUSTOM + k) onCurrentGone(ALL)
              }}
            >
              🔎 {k} ✕
            </button>
          ))}
        </div>
      )}
      <Button
        variant="line"
        onClick={() => {
          resetCats()
          onCurrentGone(ALL)
        }}
      >
        기본(세탁방·편의점·약국·마트)으로 되돌리기
      </Button>
    </div>
  )
}
