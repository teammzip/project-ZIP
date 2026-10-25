import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { banMessage, useActiveBan } from '@/features/moderation'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import { CAT_ICON, shortRegion } from '../data/display'
import { CATEGORIES, NEARBY } from '../data/seed'
import { useCommunityStore } from '../store'
import type { Post } from '../types'
import styles from './Community.module.css'
import { PostDetail } from './PostDetail'
import { PostComposer } from './PostEditor'

type Scope = 'here' | 'near' | 'all'

type Props = {
  /** 우리 동네 (내 정보에서 설정) */
  region: string
  /** 글·댓글 작성자 이름 */
  author: string
  /** 내 아이디 (이용 정지 확인용) */
  uid?: string
}

/** 인기 검색어 (누르면 그 말로 찾아 줌) */
const HOT_WORDS = ['세탁방', '배수구', '냉장고', '이사', '약국', '분리배출', '월세', '곰팡이']

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: 'here', label: '우리 동네' },
  { value: 'near', label: '주변 동네' },
  { value: 'all', label: '전체' },
]

/** 커뮤니티 "동네생활" (당근 동네생활 구성 + 에브리타임처럼 깔끔한 목록)
 * - 머리말: "○○구 동네생활" + 동네 범위(우리 동네 · 주변 동네 · 전체) + 검색
 * - 주제 칩 → 글 목록(제목 · 본문 두 줄 · 동네 · 주제 · 시간 · 공감 · 댓글, 사진이 있으면 오른쪽 썸네일)
 * - PC 오른쪽: 글쓰기 · 지금 뜨는 동네 이야기 1~5위 · 인기 검색어 / 모바일: 떠 있는 + 글쓰기
 * - 글 상세는 ?post=id, 글쓰기 · 수정은 전용 화면(PostComposer). 이용 정지 중이면 쓰기 동작을 막음 */
export function CommunityBoard({ region, author, uid }: Props) {
  const { posts, addPost } = useCommunityStore()
  const ban = useActiveBan(author, uid)
  const [params, setParams] = useSearchParams()
  const [scope, setScope] = useState<Scope>('here')
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [writing, setWriting] = useState(false)
  const selectedId = Number(params.get('post')) || null
  const locked = !!ban
  const place = region ? shortRegion(region) : '우리 동네'

  const near = NEARBY[region] ?? []
  const inScope = (p: Post) => !region || scope === 'all' || (scope === 'near' ? near.includes(p.region) : p.region === region)
  const q = query.trim().toLowerCase()
  const items = posts
    .filter((p) => inScope(p) && (cat === '전체' || p.cat === cat) && (!q || `${p.title} ${p.body}`.toLowerCase().includes(q)))
    .sort((a, b) => b.ts - a.ts)
  // 지금 뜨는 이야기: 공감 + 댓글×2 가 많은 순 (지금 보는 동네 범위 안에서)
  const hot = posts
    .filter(inScope)
    .map((p) => ({ p, score: p.likes + p.comments.length * 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.p)
  const selected = selectedId ? posts.find((p) => p.id === selectedId) : undefined

  const open = (id: number | null) => {
    setParams(id ? { post: String(id) } : {})
    window.scrollTo(0, 0)
  }
  const startWrite = () => !locked && setWriting(true)
  const scopeNote = !region
    ? '내 정보에서 우리 동네를 입력하면 동네별로 모아 볼 수 있어요.'
    : scope === 'near'
      ? near.length
        ? `${near.map(shortRegion).join(' · ')} 이웃들의 이야기`
        : '아직 이 지역의 주변 동네 정보가 없어요.'
      : scope === 'here'
        ? `📍 ${region} 이웃들의 이야기`
        : '모든 동네의 이야기'

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        {ban && (
          <p className={styles.banNotice} role="alert">
            🚫 {banMessage(ban)} 정지 중에는 글쓰기 · 댓글 · 공감을 할 수 없어요.
          </p>
        )}

        {selected ? (
          <PostDetail post={selected} author={author} locked={locked} onBack={() => open(null)} onDeleted={() => open(null)} />
        ) : (
          <>
            {/* 머리말 */}
            <header className={styles.head}>
              <div className={styles.headTop}>
                <h1>
                  {scope === 'all' ? '전체' : place} <span>동네생활</span>
                </h1>
                <div className={styles.scopes} role="radiogroup" aria-label="동네 범위">
                  {SCOPES.map((s) => (
                    <button key={s.value} type="button" role="radio" aria-checked={scope === s.value} className={cx(styles.scope, scope === s.value && styles.on)} onClick={() => setScope(s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.scopeNote}>{scopeNote}</p>
              <label className={styles.search}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`${scope === 'all' ? '전체' : scope === 'near' ? '주변 동네' : place} 이야기 검색`} aria-label="동네 이야기 검색" />
              </label>
            </header>

            {/* 새 글 쓰기 (입력창 모양) */}
            <button type="button" className={styles.composeBar} onClick={startWrite} disabled={locked}>
              <span className={styles.composeText}>
                {locked ? (
                  '이용 정지 중에는 글을 쓸 수 없어요'
                ) : (
                  <>
                    {author}님, <span className={styles.composePlace}>{place} </span>이웃에게 이야기를 남겨 보세요
                  </>
                )}
              </span>
              <b aria-hidden="true">✏️</b>
            </button>

            {/* 주제 */}
            <div className={styles.topics} role="radiogroup" aria-label="주제">
              {['전체', ...CATEGORIES].map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cat === c} className={cx(styles.topic, cat === c && styles.on)} onClick={() => setCat(c)}>
                  {c !== '전체' && `${CAT_ICON[c]} `}
                  {c}
                </button>
              ))}
            </div>

            {/* 글 목록 */}
            <ul className={styles.feed}>
              {items.map((p) => (
                <FeedItem key={p.id} post={p} onOpen={() => open(p.id)} />
              ))}
            </ul>
            {!items.length && (
              <div className={styles.empty}>
                <span aria-hidden="true">🌱</span>
                <b>{q ? `"${query}" 이야기를 찾지 못했어요` : '아직 글이 없어요'}</b>
                <small>{q ? '다른 말로 찾아보세요.' : '첫 이야기를 남겨 보세요!'}</small>
              </div>
            )}
          </>
        )}
      </div>

      {/* PC 오른쪽 칸 */}
      <aside className={styles.side} aria-label="동네생활 둘러보기">
        <button type="button" className={styles.writeBtn} onClick={startWrite} disabled={locked}>
          ✏️ 글쓰기
        </button>
        <section className={styles.sideCard}>
          <h2>🔥 지금 뜨는 동네 이야기</h2>
          <ol className={styles.hot}>
            {hot.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p.id)}>
                  <b className={cx(styles.rank, i < 3 && styles.top)}>{i + 1}</b>
                  <span className={styles.hotText}>
                    <span>{p.title}</span>
                    <small>
                      {p.cat} · 공감 {p.likes} · 댓글 {p.comments.length}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section className={styles.sideCard}>
          <h2>인기 검색어</h2>
          <div className={styles.words}>
            {HOT_WORDS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setQuery(w)
                  open(null)
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </section>
      </aside>

      {/* 모바일: 떠 있는 글쓰기 버튼 */}
      {!selected && (
        <button type="button" className={styles.fab} onClick={startWrite} disabled={locked} aria-label="글쓰기">
          ＋ 글쓰기
        </button>
      )}

      <PostComposer
        open={writing}
        onClose={() => setWriting(false)}
        locked={locked}
        region={place}
        onSave={(draft) => {
          const ok = addPost({ ...draft, region: region || '서울 마포구', author })
          if (ok) {
            setCat('전체')
            setScope('here')
            setQuery('')
            open(null)
          }
          return ok
        }}
      />
    </div>
  )
}

/** 글 목록 한 줄: 왼쪽 제목 · 본문 두 줄 · 동네 · 주제 · 시간 · 공감 · 댓글 / 오른쪽 사진 썸네일 */
function FeedItem({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const thumb = post.attachments?.find((a) => a.type.startsWith('image/') && a.data.startsWith('data:'))
  return (
    <li>
      <button type="button" className={styles.item} onClick={onOpen}>
        <span className={styles.itemMain}>
          <b className={styles.itemTitle}>{post.title}</b>
          <span className={styles.itemBody}>{post.body}</span>
          <span className={styles.itemMeta}>
            <span>
              {shortRegion(post.region)} · {post.cat} · {relTime(post.ts)}
            </span>
            <span className={styles.counts}>
              {post.likes > 0 && <span className={styles.likeCount}>♡ {post.likes}</span>}
              {post.comments.length > 0 && <span className={styles.cmtCountSm}>💬 {post.comments.length}</span>}
            </span>
          </span>
        </span>
        {thumb && <img className={styles.itemThumb} src={thumb.data} alt="" />}
      </button>
    </li>
  )
}
