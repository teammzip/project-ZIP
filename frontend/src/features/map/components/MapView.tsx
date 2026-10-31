import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { useLifeStore } from '@/features/life'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { aiFind } from '../aiFind'
import { ALL_PLACES, CAT_ICON, DEFAULT_CATS, HOME, PLACE_KINDS, PLACES, walkMin, type PlaceItem } from '../data/places'
import { useMapStore } from '../store'
import { readMapPoint } from '../location'
import { useCurrentMapPosition } from '../useCurrentMapPosition'
import styles from './MapView.module.css'

// 지도 라이브러리(Leaflet)는 크기가 커서 이 화면에 들어올 때만 받아 옴
const LeafletMap = lazy(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })))

const CUSTOM = 'c:' // 직접 추가한 검색어 칩 앞머리 ("c:카페")
const AI_EXAMPLES = ['24시간 편의점', '조용한 카페', '혼밥 저렴한 식당', '이불 빨래할 곳']

/** 목록 위 조건 칩 (장소 설명에 그 말이 있으면 남김) */
const FILTERS: Array<{ key: string; label: string; re?: RegExp }> = [
  { key: 'near', label: '가까운 순' },
  { key: '24', label: '24시간', re: /24시간|심야|야간/ },
  { key: 'cheap', label: '저렴한', re: /저렴|월 3만원/ },
  { key: 'quiet', label: '조용한', re: /조용|스터디/ },
]

const bigUrl = (p: PlaceItem) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`
const routeUrl = (p: PlaceItem) => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${HOME.lat}%2C${HOME.lon}%3B${p.lat}%2C${p.lon}`
const walkText = (p: PlaceItem) => (walkMin(p) < 99 ? `도보 ${walkMin(p)}분` : '거리 정보 없음')
/** 설명에서 "도보 약 N분"을 뺀 특징들 */
const tagsOf = (p: PlaceItem) =>
  p.d
    .split('·')
    .map((t) => t.trim())
    .filter((t) => t && !/도보/.test(t))
/** 종류마다 정해진 연한 배경 (썸네일) */
const tint = (cat: string) => `hsl(${[...cat].reduce((h, c) => h + c.charCodeAt(0), 0) % 360} 75% 93%)`

const MOBILE = '(max-width: 900px)'
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useMobile = () => useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE).matches)

type Found = { q: string; items: Array<{ p: PlaceItem; why: string[] }> }

/** 동네 지도 (네이버 지도처럼)
 * - 모바일: 화면 가득 지도 + 위에 검색창 · 종류 칩, 오른쪽 둥근 버튼(저장 · 내 위치), 아래 끌어올리는 시트(동네 · 저장 탭, 장소 목록)
 * - PC: 왼쪽 목록 칸(검색 · 탭 · 목록 · 상세) + 오른쪽 넓은 지도(위에 종류 칩)
 * - 검색은 장소 이름 + AI 장소 찾기("밤에 갈 수 있는 약국" → 가까운 순 추천 + 이유, 시연용)
 * - ★ 저장(즐겨찾기), 종류 편집(켜기 · 끄기 · 직접 검색어), ?cat=세탁방 으로 열면 그 종류부터 */
export function MapView() {
  const { on, custom, favs, ensureCat } = useMapStore()
  const region = useLifeStore((s) => s.settings.region)
  const mobile = useMobile()
  const [params] = useSearchParams()
  const location = useLocation()
  const position = useCurrentMapPosition(readMapPoint(location.state?.mapCenter))
  const asked = params.get('cat')
  const [cat, setCat] = useState(() => (asked && PLACES[asked] ? asked : (on[0] ?? DEFAULT_CATS[0])))
  const [tab, setTab] = useState<'near' | 'fav'>('near')
  const [filter, setFilter] = useState('near')
  const [selId, setSelId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<'peek' | 'full'>('peek')
  const [focus, setFocus] = useState<{ lat: number; lon: number; n: number } | null>(null)
  const [centerRequest, setCenterRequest] = useState(0)
  const drag = useRef<number | null>(null)

  // 주소로 받은 종류가 꺼져 있으면 칩에 켬
  useEffect(() => {
    if (asked) ensureCat(asked)
  }, [asked, ensureCat])

  const base = (() => {
    if (found) return found.items.map((r) => r.p)
    if (tab === 'fav') return ALL_PLACES.filter((p) => favs.includes(p.id))
    if (cat.startsWith(CUSTOM)) {
      const kw = cat.slice(CUSTOM.length)
      return ALL_PLACES.filter((p) => (p.n + p.d + p.cat).includes(kw))
    }
    return ALL_PLACES.filter((p) => p.cat === cat)
  })()
  const rule = FILTERS.find((f) => f.key === filter)?.re
  const list = (found ? base : [...base].sort((a, b) => walkMin(a) - walkMin(b))).filter((p) => !rule || rule.test(p.d))
  const selected = selId ? ALL_PLACES.find((p) => p.id === selId) : undefined
  // 지도에는 목록 + (목록에 없으면) 고른 곳
  const pins = selected && !list.some((p) => p.id === selected.id) ? [...list, selected] : list
  const fitKey = `${found?.q ?? ''}|${tab}|${cat}|${filter}|${centerRequest}`
  const place = region.split(' ').slice(1).join(' ') || region || '우리 동네'
  const bottomInset = mobile && sheet === 'peek' ? Math.round(window.innerHeight * 0.4) : 0

  const select = (p: PlaceItem) => {
    setSelId(p.id)
    setFocus({ lat: p.lat, lon: p.lon, n: Date.now() })
    setSheet('peek')
  }
  const pickCat = (c: string) => {
    setCat(c)
    setTab('near')
    setFound(null)
    setSelId(null)
    setFocus(null)
  }
  const search = (q: string) => {
    const text = q.trim()
    if (!text) return setFound(null)
    let items = aiFind(text).map((r) => ({ p: r.p, why: r.why }))
    if (!items.length) items = ALL_PLACES.filter((p) => (p.n + p.d + p.cat).includes(text)).map((p) => ({ p, why: [`"${text}" 포함`] }))
    setQuery(text)
    setFound({ q: text, items })
    setFilter('near')
    setSelId(null)
    setFocus(null)
    setSheet('peek')
  }
  const goCurrent = () => {
    setSelId(null)
    setSheet('peek')
    setFocus(null)
    setCenterRequest((value) => value + 1)
    position.retry()
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
        search(query)
      }}
    >
      <span className={styles.searchPin} aria-hidden="true">
        📍
      </span>
      <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={40} placeholder="장소 검색 · AI에게 물어보기" aria-label="장소 검색 또는 AI에게 물어보기" type="search" />
      {found && (
        <button
          type="button"
          className={styles.searchX}
          onClick={() => {
            setQuery('')
            setFound(null)
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
        <Suspense fallback={<div className={styles.map} />}>
          <LeafletMap
            className={styles.map} places={pins} selectedId={selId} onSelect={(id) => select(ALL_PLACES.find((p) => p.id === id)!)}
            focus={focus} fitKey={fitKey} bottomInset={bottomInset}
            viewport={!selected && position.point ? { ...position.point, zoom: 16 } : undefined}
            currentPosition={position.point}
          />
        </Suspense>

        <div className={styles.overlayTop}>
          <div className={styles.mobileOnly}>{searchBox}</div>
          {/* 종류 칩 */}
          <div className={styles.chips} role="radiogroup" aria-label="장소 종류">
            {on.map((c) => (
              <Chip key={c} on={!found && tab === 'near' && cat === c} onClick={() => pickCat(c)}>
                {CAT_ICON[c] ?? '📍'} {c}
              </Chip>
            ))}
            {custom.map((k) => (
              <Chip key={k} on={!found && tab === 'near' && cat === CUSTOM + k} onClick={() => pickCat(CUSTOM + k)}>
                🔎 {k}
              </Chip>
            ))}
            <button type="button" className={cx(styles.chip, styles.chipEdit)} onClick={() => setEditing(true)}>
              ⚙ 편집
            </button>
          </div>
        </div>

        {/* 오른쪽 둥근 버튼 */}
        <div className={styles.fabs}>
          <button
            type="button"
            className={cx(styles.fab, tab === 'fav' && !found && styles.fabOn)}
            onClick={() => {
              setFound(null)
              setTab(tab === 'fav' ? 'near' : 'fav')
            }}
            aria-pressed={tab === 'fav'}
            aria-label="저장한 장소"
            title="저장한 장소"
          >
            ★
          </button>
          <button type="button" className={styles.fab} onClick={goCurrent} disabled={position.loading} aria-label="내 위치로 이동" title={position.loading ? '위치 확인 중…' : '내 위치로 이동'}>
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
          <p className={styles.note} role="status">
            {position.loading ? '현재 위치를 확인하고 있어요.' : position.error ? `${position.error} ${position.point ? '마지막으로 확인한 위치를 표시해요.' : '예시 지도를 표시해요.'}` : '파란 점이 내 위치예요.'}
          </p>
          {selected ? (
            <PlaceDetail p={selected} onBack={() => {
              setSelId(null)
              setFocus(null)
            }} />
          ) : (
            <>
              <div className={styles.tabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'near' && !found}
                  className={cx(styles.tab, tab === 'near' && !found && styles.tabOn)}
                  onClick={() => {
                    setFound(null)
                    setTab('near')
                  }}
                >
                  <i aria-hidden="true">📍</i> {place}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'fav' && !found}
                  className={cx(styles.tab, tab === 'fav' && !found && styles.tabOn)}
                  onClick={() => {
                    setFound(null)
                    setTab('fav')
                  }}
                >
                  <i aria-hidden="true">★</i> 저장 {favs.length}
                </button>
              </div>

              <h2 className={styles.listTitle}>
                {found ? (
                  <>
                    <span className={styles.ai}>✨ AI 추천</span> &ldquo;{found.q}&rdquo;
                  </>
                ) : tab === 'fav' ? (
                  '저장한 장소'
                ) : (
                  <>이 주변 {cat.startsWith(CUSTOM) ? cat.slice(CUSTOM.length) : cat}</>
                )}
                <small>{list.length}곳</small>
              </h2>

              {!found && (
                <div className={styles.filters}>
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" className={cx(styles.filter, filter === f.key && styles.filterOn)} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                      {f.key !== 'near' && '# '}
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {found && !found.items.length && <p className={styles.empty}>&ldquo;{found.q}&rdquo;에 맞는 곳을 못 찾았어요. 다른 말로 물어보거나 ⚙ 편집에서 종류를 추가해 보세요.</p>}
              {!found && (
                <div className={styles.examples}>
                  {AI_EXAMPLES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setQuery(q)
                        search(q)
                      }}
                    >
                      ✨ {q}
                    </button>
                  ))}
                </div>
              )}

              <ol className={styles.list}>
                {list.map((p, i) => (
                  <PlaceRow key={p.id} p={p} rank={i + 1} why={found?.items.find((r) => r.p.id === p.id)?.why} onClick={() => select(p)} />
                ))}
              </ol>
              {!found && !list.length && <p className={styles.empty}>{tab === 'fav' ? '아직 저장한 장소가 없어요. 장소 오른쪽의 ☆를 눌러 보세요.' : '이 조건의 장소가 예시 데이터에 없어요.'}</p>}
              <p className={styles.note}>장소는 예시 데이터예요. 지도 © OpenStreetMap</p>
            </>
          )}
        </div>
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="장소 종류 편집">
        <h3 className={styles.editTitle}>장소 종류 편집</h3>
        <CategoryEditor current={cat} onCurrentGone={(next) => pickCat(next)} onAdded={(k) => pickCat(CUSTOM + k)} />
      </Modal>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={cx(styles.chip, on && styles.chipOn)} onClick={onClick}>
      {children}
    </button>
  )
}

/** ☆ / ★ 저장 버튼 */
function FavStar({ p, big }: { p: PlaceItem; big?: boolean }) {
  const fav = useMapStore((s) => s.favs.includes(p.id))
  const toggleFav = useMapStore((s) => s.toggleFav)
  return (
    <button
      type="button"
      className={cx(styles.star, fav && styles.starOn, big && styles.starBig)}
      aria-label={fav ? `${p.n} 저장 취소` : `${p.n} 저장`}
      aria-pressed={fav}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        toggleFav(p.id)
      }}
    >
      {fav ? '★' : '☆'}
      {big && <span>{fav ? '저장됨' : '저장'}</span>}
    </button>
  )
}

/** 목록 한 줄: 왼쪽 썸네일, 순위 · 이름 · 종류 · 도보, 특징 칩 (AI 추천이면 추천 이유) */
function PlaceRow({ p, rank, why, onClick }: { p: PlaceItem; rank: number; why?: string[]; onClick: () => void }) {
  return (
    <li>
      <div className={styles.row} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
        <span className={styles.thumb} style={{ background: tint(p.cat) }} aria-hidden="true">
          {CAT_ICON[p.cat] ?? '📍'}
        </span>
        <span className={styles.rowMain}>
          <span className={styles.rowName}>
            <i>{rank}</i>
            <b>{p.n}</b>
          </span>
          <small>
            {p.cat} · {walkText(p)}
          </small>
          <span className={styles.rowTag}>{why ? `추천 이유: ${why.join(' · ')}` : tagsOf(p).join(' · ') || '동네 장소'}</span>
        </span>
        <FavStar p={p} />
      </div>
    </li>
  )
}

/** 장소 상세: 이름 · 종류 · 도보, 특징, 저장 · 길찾기 · 큰 지도 */
function PlaceDetail({ p, onBack }: { p: PlaceItem; onBack: () => void }) {
  return (
    <div className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        ‹ 목록
      </button>
      <div className={styles.detailHead}>
        <span className={styles.thumbBig} style={{ background: tint(p.cat) }} aria-hidden="true">
          {CAT_ICON[p.cat] ?? '📍'}
        </span>
        <div>
          <h2>{p.n}</h2>
          <small>
            {p.cat} · 🏠 우리 집에서 {walkText(p)}
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
          <b>↗</b>
          <span>길찾기</span>
        </a>
        <a className={styles.action} href={bigUrl(p)} target="_blank" rel="noopener noreferrer">
          <b>🗺</b>
          <span>큰 지도</span>
        </a>
      </div>
    </div>
  )
}

/** 종류 편집: 종류 켜기·끄기, 직접 검색어 추가·삭제, 기본값으로 되돌리기 */
function CategoryEditor({ current, onCurrentGone, onAdded }: { current: string; onCurrentGone: (next: string) => void; onAdded: (kw: string) => void }) {
  const { on, custom, toggleCat, addCustom, removeCustom, resetCats } = useMapStore()
  const [kw, setKw] = useState('')

  return (
    <div className={styles.editor}>
      <p className={common.note}>지도 위 칩에 보일 장소 종류를 눌러 켜고 끄세요. (✓ = 지금 보이는 종류)</p>
      <div className={common.chips}>
        {PLACE_KINDS.map((c) => {
          const isOn = on.includes(c)
          return (
            <button
              key={c}
              type="button"
              className={cx(common.chip, isOn && common.chipOn)}
              aria-pressed={isOn}
              onClick={() => {
                toggleCat(c)
                if (isOn && current === c) onCurrentGone(on.find((x) => x !== c) ?? DEFAULT_CATS[0])
              }}
            >
              {isOn && '✓ '}
              {CAT_ICON[c] ?? '📍'} {c} {PLACES[c].length}
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
                if (current === CUSTOM + k) onCurrentGone(on[0] ?? DEFAULT_CATS[0])
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
          onCurrentGone(DEFAULT_CATS[0])
        }}
      >
        기본(세탁방·편의점·약국·마트)으로 되돌리기
      </Button>
    </div>
  )
}
