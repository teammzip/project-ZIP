import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { useLifeStore } from '@/features/life'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { aiFind, type FoundPlace } from '../aiFind'
import { ALL_PLACES, CAT_ICON, DEFAULT_CATS, PLACE_KINDS, PLACES, walkMin, type PlaceItem } from '../data/places'
import { useMapStore } from '../store'
import styles from './MapView.module.css'

const FAV = '__fav' // 칩 "즐겨찾기"
const CUSTOM = 'c:' // 직접 추가한 검색어 칩 앞머리 ("c:카페")
const AI_EXAMPLES = ['24시간 편의점', '조용한 카페', '혼밥 저렴한 식당', '이불 빨래할 곳']

const embedUrl = (p: PlaceItem) => {
  const bbox = [p.lon - 0.004, p.lat - 0.0025, p.lon + 0.004, p.lat + 0.0025].join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${p.lat}%2C${p.lon}`
}
const bigUrl = (p: PlaceItem) => `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=17/${p.lat}/${p.lon}`

/** 우리 동네 지도(OpenStreetMap) + 주변 장소 (팀장님 시안 views/map.js 와 같은 구성)
 * - AI 장소 찾기: "밤에 갈 수 있는 약국"처럼 말로 찾으면 가까운 순으로 추천 + 추천 이유 (시연용, 예시 데이터 안에서)
 * - ★ 즐겨찾기, 카테고리 편집(종류 켜기·끄기, 직접 검색어 추가, 기본값으로)
 * - ?cat=세탁방 으로 열면 그 종류부터 (꺼져 있으면 켬) */
export function MapView() {
  const { on, custom, favs, ensureCat } = useMapStore()
  const region = useLifeStore((s) => s.settings.region)
  const [params] = useSearchParams()
  const asked = params.get('cat')
  const [chip, setChip] = useState(() => (asked && PLACES[asked] ? asked : (on[0] ?? FAV)))
  const [selId, setSelId] = useState<string | null>(null)
  const [aiQ, setAiQ] = useState('')
  const [aiOut, setAiOut] = useState<{ q: string; items: FoundPlace[] } | null>(null)
  const [editing, setEditing] = useState(false)

  // 주소로 받은 종류가 꺼져 있으면 칩에 켬
  useEffect(() => {
    if (asked) ensureCat(asked)
  }, [asked, ensureCat])

  const listFor = (c: string) => {
    if (c === FAV) return ALL_PLACES.filter((p) => favs.includes(p.id)).sort((a, b) => walkMin(a) - walkMin(b))
    if (c.startsWith(CUSTOM)) {
      const kw = c.slice(CUSTOM.length)
      return ALL_PLACES.filter((p) => (p.n + p.d + p.cat).includes(kw))
    }
    return ALL_PLACES.filter((p) => p.cat === c)
  }
  const list = listFor(chip)
  const place = ALL_PLACES.find((p) => p.id === selId) ?? list[0] ?? ALL_PLACES[0]

  const pickChip = (c: string) => {
    setChip(c)
    setSelId(listFor(c)[0]?.id ?? null)
  }
  /** AI 결과에서 고르면 그 종류 칩으로 바꾸고 지도를 그 위치로 */
  const choose = (p: PlaceItem) => {
    ensureCat(p.cat)
    setChip(p.cat)
    setSelId(p.id)
  }
  const find = (q: string) => {
    const query = q.trim()
    if (!query) return
    const items = aiFind(query)
    setAiQ(query)
    setAiOut({ q: query, items })
    if (items[0]) choose(items[0].p) // 가장 잘 맞는 곳을 지도에 바로 표시
  }

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

      <Card
        title="주변 장소"
        actions={
          <button type="button" className={styles.linkBtn} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? '편집 닫기' : '카테고리 편집'}
          </button>
        }
      >
        {/* AI 장소 찾기 */}
        <form
          className={styles.aiFind}
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            find(aiQ)
          }}
        >
          <input value={aiQ} onChange={(e) => setAiQ(e.target.value)} maxLength={40} placeholder="AI에게 물어보기: 예) 밤에 갈 수 있는 약국" aria-label="AI에게 장소 물어보기" />
          <Button type="submit">✨ AI로 찾기</Button>
        </form>
        <div className={styles.examples}>
          {AI_EXAMPLES.map((q) => (
            <button key={q} type="button" className={common.chip} onClick={() => find(q)}>
              {q}
            </button>
          ))}
        </div>

        {aiOut && (
          <div className={styles.aiOut}>
            <div className={styles.aiOutHead}>
              <span>
                {aiOut.items.length
                  ? `"${aiOut.q}" → ${region ? `${region} ` : ''}집 근처에서 가까운 순으로 ${aiOut.items.length}곳을 골랐어요.`
                  : `"${aiOut.q}" 에 맞는 곳을 못 찾았어요. 다른 말로 물어보거나 "카테고리 편집"에서 종류를 추가해 보세요.`}
              </span>
              <button type="button" className={styles.aiOutX} onClick={() => setAiOut(null)} aria-label="결과 닫기">
                ✕
              </button>
            </div>
            {aiOut.items.map((r) => (
              <PlaceRow
                key={r.p.id}
                p={r.p}
                on={r.p.id === place.id}
                title={`${CAT_ICON[r.p.cat] ?? '📍'} ${r.p.n}`}
                why={`추천 이유: ${[...r.why, `도보 ${walkMin(r.p) < 99 ? `${walkMin(r.p)}분` : '정보 없음'}`].join(' · ')}`}
                onClick={() => choose(r.p)}
              />
            ))}
            <p className={common.note}>AI 찾기는 시연용이에요. 예시 데이터 안에서 말을 읽어 고르고, 실제 서비스에서는 AI와 지도 검색 API가 근처 장소를 찾아 줘요.</p>
          </div>
        )}

        {/* 칩: 즐겨찾기 · 켜 둔 종류 · 직접 추가한 검색어 */}
        <div className={common.chips}>
          <ChipBtn on={chip === FAV} onClick={() => pickChip(FAV)}>
            ★ 즐겨찾기 {favs.length}
          </ChipBtn>
          {on.map((c) => (
            <ChipBtn key={c} on={chip === c} onClick={() => pickChip(c)}>
              {CAT_ICON[c] ?? '📍'} {c}
            </ChipBtn>
          ))}
          {custom.map((k) => (
            <ChipBtn key={k} on={chip === CUSTOM + k} onClick={() => pickChip(CUSTOM + k)}>
              🔎 {k}
            </ChipBtn>
          ))}
        </div>

        {editing && <CategoryEditor current={chip} onCurrentGone={(next) => pickChip(next)} onAdded={(k) => pickChip(CUSTOM + k)} />}

        {list.length === 0 ? (
          <p className={common.empty}>
            {chip === FAV ? '아직 즐겨찾기한 장소가 없어요. 장소 오른쪽의 ☆를 눌러 보세요.' : '예시 데이터에는 이 조건의 장소가 없어요. 실제 서비스에서는 지도 검색으로 찾아와요.'}
          </p>
        ) : (
          list.map((p) => (
            <PlaceRow
              key={p.id}
              p={p}
              on={p.id === place.id}
              title={p.n}
              sub={`${chip === FAV || chip.startsWith(CUSTOM) ? `${p.cat} · ` : ''}${p.d}`}
              onClick={() => setSelId(p.id)}
            />
          ))
        )}
      </Card>
    </div>
  )
}

function ChipBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={cx(common.chip, on && common.chipOn)} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}

/** 장소 한 줄: 왼쪽 글, 오른쪽 즐겨찾기 별 */
function PlaceRow({ p, on, title, sub, why, onClick }: { p: PlaceItem; on: boolean; title: string; sub?: string; why?: string; onClick: () => void }) {
  const fav = useMapStore((s) => s.favs.includes(p.id))
  const toggleFav = useMapStore((s) => s.toggleFav)
  return (
    <div className={cx(styles.place, on && styles.on)} role="button" tabIndex={0} aria-pressed={on} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className={styles.placeMain}>
        <b>{title}</b>
        <small>{sub ?? p.d}</small>
        {why && <small className={styles.why}>{why}</small>}
      </div>
      <button
        type="button"
        className={cx(styles.star, fav && styles.starOn)}
        aria-label={fav ? `${p.n} 즐겨찾기 해제` : `${p.n} 즐겨찾기에 추가`}
        aria-pressed={fav}
        onClick={(e: MouseEvent) => {
          e.stopPropagation()
          toggleFav(p.id)
        }}
      >
        {fav ? '★' : '☆'}
      </button>
    </div>
  )
}

/** 카테고리 편집: 종류 켜기·끄기, 직접 검색어 추가·삭제, 기본값으로 되돌리기 */
function CategoryEditor({ current, onCurrentGone, onAdded }: { current: string; onCurrentGone: (next: string) => void; onAdded: (kw: string) => void }) {
  const { on, custom, toggleCat, addCustom, removeCustom, resetCats } = useMapStore()
  const [kw, setKw] = useState('')

  return (
    <div className={styles.editor}>
      <p className={common.note}>보고 싶은 장소 종류를 눌러 켜고 끄세요. (✓ 표시 = 지금 보이는 종류)</p>
      <div className={common.chips}>
        {PLACE_KINDS.map((c) => {
          const isOn = on.includes(c)
          return (
            <ChipBtn
              key={c}
              on={isOn}
              onClick={() => {
                toggleCat(c)
                if (isOn && current === c) onCurrentGone(on.find((x) => x !== c) ?? FAV)
              }}
            >
              {isOn && '✓ '}
              {CAT_ICON[c] ?? '📍'} {c} {PLACES[c].length}
            </ChipBtn>
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
                if (current === CUSTOM + k) onCurrentGone(on[0] ?? FAV)
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
