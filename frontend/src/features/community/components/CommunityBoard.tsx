import { useEffect, useRef, useState } from 'react'
import { isMockApi } from '@/features/auth'
import { useSearchParams } from 'react-router-dom'
import { normRegion, RegionAccessGate, RegionVerifyDialog, useRegionVerify } from '@/features/life'
import { banMessage, useActiveBan } from '@/features/moderation'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import { CAT_ICON, shortRegion } from '../data/display'
import { CATEGORIES, NEARBY } from '../data/seed'
import { serverNearNote } from '../neighborNote'
import { popularityOf, searchLocalPosts, suggestLocalPostQuery, type PostSort } from '../postSearch'
import { useCommunityStore } from '../store'
import { commentCountOf, type Post } from '../types'
import { useCommunityActions, useServerNeighbors, useServerPost, useServerPosts } from '../useCommunity'
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

// 주변 동네 표는 시·군·구 단위이므로 모의 주소에 행정동이 붙어도 같은 키를 사용한다.
function mockRegionKey(value: string) {
  const normalized = normRegion(value)
  const words = normalized.split(' ')
  const cityOrDistrict = words.slice(0, 2).join(' ')
  if (Object.hasOwn(NEARBY, cityOrDistrict)) return cityOrDistrict
  return Object.hasOwn(NEARBY, words[0]) ? words[0] : normalized
}

/** 커뮤니티 "동네생활" (당근 동네생활 구성 + 에브리타임처럼 깔끔한 목록)
 * - 머리말: "○○구 동네생활" + 동네 범위(우리 동네 · 주변 동네 · 전체) + 검색
 * - 주제 칩 → 글 목록(제목 · 본문 두 줄 · 동네 · 주제 · 시간 · 공감 · 댓글, 사진이 있으면 오른쪽 썸네일)
 * - PC 오른쪽: 글쓰기 · 지금 뜨는 동네 이야기 1~5위 · 인기 검색어 / 모바일: 떠 있는 + 글쓰기
 * - 글 상세는 ?post=id, 글쓰기 · 수정은 전용 화면(PostComposer). 이용 정지 중이면 쓰기 동작을 막음
 * - 글쓰기 · 댓글 · 공감은 동네 인증을 한 사람만 (안 했으면 인증 창을 띄움). 읽기는 누구나 */
export function CommunityBoard(props: Props) {
  return <RegionAccessGate><VerifiedCommunityBoard {...props} /></RegionAccessGate>
}

function VerifiedCommunityBoard({ region, author, uid }: Props) {
  const localPosts = useCommunityStore((state) => state.posts)
  const actions = useCommunityActions()
  const { recordView } = actions
  const ban = useActiveBan(author, uid)
  const [params, setParams] = useSearchParams()
  const [scope, setScope] = useState<Scope>('here')
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [browseSort, setBrowseSort] = useState<Exclude<PostSort, 'relevance'>>('latest')
  const [searchSort, setSearchSort] = useState<PostSort>('relevance')
  const [writing, setWriting] = useState(false)
  // 동네 인증 창 (인증을 마치면 하려던 동작을 이어서: 글쓰기면 글쓰기 화면 열기)
  const [verifyFor, setVerifyFor] = useState<'write' | 'act' | null>(null)
  const { verified } = useRegionVerify()
  const selectedId = Number(params.get('post')) || null
  const locked = !!ban
  const place = region ? shortRegion(region) : '우리 동네'

  const here = mockRegionKey(region)
  const near = Object.hasOwn(NEARBY, here) ? NEARBY[here] : []
  const inScope = (post: Post) => {
    const postRegion = mockRegionKey(post.region)
    return scope === 'all' || (!!here && (postRegion === here || (scope === 'near' && near.includes(postRegion))))
  }
  const q = query.trim()
  const sort = q ? searchSort : browseSort
  const changeQuery = (value: string) => {
    if (!q && value.trim()) setSearchSort('relevance')
    setQuery(value)
  }
  const changeSort = (value: PostSort) => {
    if (q) setSearchSort(value)
    else if (value !== 'relevance') setBrowseSort(value)
  }
  // 서버 모드: 검색어는 0.3초 멈추면 서버에 물어봄 (글자마다 부르지 않게)
  const [serverQ, setServerQ] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setServerQ(query), 300)
    return () => clearTimeout(timer)
  }, [query])
  const serverQuery = serverQ.trim()
  const server = useServerPosts(scope, cat, serverQuery, serverQuery ? searchSort : browseSort)
  // 서버 모드 "주변 동네" 탭: 내 동네와 이웃 동네 이름을 서버에서 받아 안내 (탭을 열 때만)
  const serverNeighbors = useServerNeighbors(scope === 'near')
  const serverPost = useServerPost(selectedId)
  const serverItems = [...new Map(server.data?.pages.flatMap((page) => page.items.map((post) => [post.id, post] as const))).values()]
  // 가짜 API 모드는 이 브라우저 글을 여기서 거르고, 서버 모드는 서버가 걸러 준 글
  const scopedLocalPosts = isMockApi ? localPosts.filter((p) => inScope(p) && (cat === '전체' || p.cat === cat)) : []
  const items = isMockApi ? searchLocalPosts(scopedLocalPosts, q, sort) : serverItems
  const showEmpty = !items.length && (isMockApi || (serverQuery === q && server.isSuccess && !server.isFetching))
  const suggestedQuery = showEmpty && q
    ? (isMockApi ? suggestLocalPostQuery(scopedLocalPosts, q) : server.data?.pages[0]?.suggestedQuery)
    : undefined
  // 지금 뜨는 이야기: 공감 + 댓글×2 가 많은 순 (지금 보는 동네 범위 안에서)
  const hot = (isMockApi ? localPosts.filter(inScope) : serverItems)
    .map((p) => ({ p, score: popularityOf(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.p)
  const selected = selectedId ? (isMockApi ? localPosts.find((p) => p.id === selectedId) : serverPost.data) : undefined

  const viewedId = selected?.id
  const lastView = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (viewedId && lastView.current !== viewedId) recordView(viewedId)
    lastView.current = viewedId
  }, [viewedId, recordView])

  const open = (id: number | null) => {
    setParams(id ? { post: String(id) } : {})
    window.scrollTo(0, 0)
  }
  const startWrite = () => {
    if (locked) return
    if (!verified) return setVerifyFor('write')
    setWriting(true)
  }
  const scopeNote = !isMockApi && scope === 'near'
    ? serverNearNote(serverNeighbors)
    : !region
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
          <PostDetail post={selected} author={author} locked={locked} verified={verified} onVerify={() => setVerifyFor('act')} onBack={() => open(null)} onDeleted={() => open(null)} />
        ) : selectedId && !isMockApi && (serverPost.isLoading || serverPost.isError) ? (
          // 서버 모드: 글을 불러오는 중이거나 지워진 글
          <div className={styles.empty}>
            <b>{serverPost.isLoading ? '글을 불러오고 있어요…' : '지워졌거나 볼 수 없는 글이에요.'}</b>
            <button type="button" className={styles.back} onClick={() => open(null)}>
              ‹ 동네생활로
            </button>
          </div>
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
              <p className={styles.scopeNote}>
                {scopeNote}
                {scope === 'here' &&
                  region &&
                  (verified ? (
                    <span className={styles.verified}>✔ 인증</span>
                  ) : (
                    <button type="button" className={styles.verifyLink} onClick={() => setVerifyFor('act')}>
                      동네 인증하기 ›
                    </button>
                  ))}
              </p>
              <label className={styles.search}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  value={query}
                  maxLength={40}
                  onChange={(e) => changeQuery(e.target.value)}
                  placeholder={`${scope === 'all' ? '전체' : scope === 'near' ? '주변 동네' : place} 이야기 검색`}
                  aria-label="동네 이야기 검색"
                />
              </label>
            </header>

            {/* 새 글 쓰기 (입력창 모양) */}
            <button type="button" className={styles.composeBar} onClick={startWrite} disabled={locked}>
              <span className={styles.composeText}>
                {locked ? (
                  '이용 정지 중에는 글을 쓸 수 없어요'
                ) : (
                  <>
                    {author}님, <span className={styles.composePlace}>{place} </span>
                    {verified ? '이웃에게 이야기를 남겨 보세요' : '동네 인증하고 이웃과 이야기해요'}
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

            <label className={styles.sort}>
              정렬
              <select value={sort} onChange={(event) => changeSort(event.target.value as PostSort)}>
                {q && <option value="relevance">관련도순</option>}
                <option value="latest">최신순</option>
                <option value="views">조회순</option>
                <option value="popular">인기순</option>
              </select>
            </label>

            {/* 글 목록 */}
            <ul className={styles.feed}>
              {items.map((p) => (
                <FeedItem key={p.id} post={p} showViews={sort === 'views'} onOpen={() => open(p.id)} />
              ))}
            </ul>
            {!isMockApi && server.isError && (
              <p className={styles.scopeNote} role="alert">
                글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </p>
            )}
            {!isMockApi && server.hasNextPage && (
              <button type="button" className={styles.moreBtn} onClick={() => void server.fetchNextPage()} disabled={server.isFetchingNextPage}>
                {server.isFetchingNextPage ? '불러오는 중…' : '글 더 보기'}
              </button>
            )}
            {showEmpty && (
              <div className={styles.empty} aria-live="polite">
                <span aria-hidden="true">🌱</span>
                <b>{q ? `"${query}" 이야기를 찾지 못했어요` : '아직 글이 없어요'}</b>
                {suggestedQuery ? (
                  <button type="button" className={cx(styles.moreBtn, styles.searchSuggestion)} onClick={() => changeQuery(suggestedQuery)}>
                    ‘{suggestedQuery}’로 검색
                  </button>
                ) : <small>{q ? '다른 말로 찾아보세요.' : '첫 이야기를 남겨 보세요!'}</small>}
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
                      {p.cat} · 공감 {p.likes} · 댓글 {commentCountOf(p)}
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
                  changeQuery(w)
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

      <RegionVerifyDialog open={!!verifyFor} onClose={() => setVerifyFor(null)} onVerified={() => verifyFor === 'write' && setWriting(true)} />

      <PostComposer
        open={writing}
        onClose={() => setWriting(false)}
        locked={locked}
        region={place}
        onSave={async (draft) => {
          const problem = await actions.addPost(draft, region || '서울 마포구', author)
          if (!problem) {
            setCat('전체')
            setScope('here')
            setQuery('')
            setBrowseSort('latest')
            open(null)
          }
          return problem
        }}
      />
    </div>
  )
}

/** 글 목록 한 줄: 왼쪽 제목 · 본문 두 줄 · 동네 · 주제 · 시간 · 공감 · 댓글 / 오른쪽 사진 썸네일 */
function FeedItem({ post, showViews, onOpen }: { post: Post; showViews: boolean; onOpen: () => void }) {
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
              {showViews && <span>조회 {post.views ?? 0}</span>}
              {post.likes > 0 && <span className={styles.likeCount}>♡ {post.likes}</span>}
              {commentCountOf(post) > 0 && <span className={styles.cmtCountSm}>💬 {commentCountOf(post)}</span>}
            </span>
          </span>
        </span>
        {thumb && <img className={styles.itemThumb} src={thumb.data} alt="" />}
      </button>
    </li>
  )
}
