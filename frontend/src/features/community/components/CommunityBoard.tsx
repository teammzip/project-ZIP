import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, Segmented } from '@/components/ui'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import common from '@/styles/common.module.css'
import { CATEGORIES, NEARBY } from '../data/seed'
import { useCommunityStore } from '../store'
import type { Post } from '../types'
import styles from './Community.module.css'

type Scope = 'here' | 'near' | 'all'

type Props = {
  /** 우리 동네 (내 정보에서 설정) */
  region: string
  /** 글·댓글 작성자 이름 */
  author: string
}

/** 커뮤니티: 동네 범위 · 분류로 글 목록 보기, 글 상세(?post=id), 좋아요 · 댓글 · 글쓰기 */
export function CommunityBoard({ region, author }: Props) {
  const { posts, addPost } = useCommunityStore()
  const [params, setParams] = useSearchParams()
  const [scope, setScope] = useState<Scope>('here')
  const [cat, setCat] = useState('전체')
  const [form, setForm] = useState({ cat: CATEGORIES[0] as string, title: '', body: '' })
  const selectedId = Number(params.get('post')) || null

  const near = NEARBY[region] ?? []
  const items = posts
    .filter((p) => {
      if (cat !== '전체' && p.cat !== cat) return false
      if (!region || scope === 'all') return true
      return scope === 'near' ? near.includes(p.region) : p.region === region
    })
    .sort((a, b) => b.ts - a.ts)
  const selected = selectedId ? posts.find((p) => p.id === selectedId) : undefined

  const open = (id: number | null) => {
    setParams(id ? { post: String(id) } : {})
    window.scrollTo(0, 0)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    const body = form.body.trim()
    if (!title || !body) return
    addPost({ region: region || '서울 마포구', cat: form.cat, title, body, author })
    setForm({ ...form, title: '', body: '' })
    setCat('전체')
    setScope('here')
    open(null)
  }

  const title = scope === 'all' ? '전체 동네 이야기' : scope === 'near' ? '주변 동네 이야기' : region ? `${region} 이야기` : '우리 동네 이야기'
  const note = !region
    ? '내 정보에서 우리 동네를 입력하면 동네별로 모아 볼 수 있어요.'
    : scope === 'near'
      ? near.length
        ? `📍 ${near.join(' · ')} 글을 보여줘요.`
        : '아직 이 지역의 주변 동네 정보가 없어요.'
      : scope === 'here'
        ? `📍 ${region} 이웃들의 글이에요.`
        : '모든 동네의 글을 보여줘요.'

  return (
    <div className={common.layout}>
      <Card
        title={title}
        actions={
          <Segmented
            label="동네 범위"
            value={scope}
            onChange={(v) => {
              setScope(v)
              open(null)
            }}
            options={[
              { value: 'here', label: '우리 동네' },
              { value: 'near', label: '주변 동네' },
              { value: 'all', label: '전체' },
            ]}
          />
        }
      >
        {selected ? (
          <>
            <Button variant="line" className={styles.back} onClick={() => open(null)}>
              ‹ 목록으로
            </Button>
            <PostItem post={selected} author={author} detail />
          </>
        ) : (
          <>
            <p className={styles.scopeNote}>{note}</p>
            <div className={common.chips}>
              {['전체', ...CATEGORIES].map((c) => (
                <button key={c} type="button" className={cx(common.chip, c === cat && common.chipOn)} aria-pressed={c === cat} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
            {items.map((p) => (
              <PostItem key={p.id} post={p} author={author} onOpen={() => open(p.id)} />
            ))}
            {!items.length && <p className={common.empty}>아직 글이 없어요. 첫 글을 써보세요!</p>}
          </>
        )}
      </Card>

      <Card title="글쓰기" actions={region && <span className={styles.loc}>📍 {region}</span>}>
        <form className={common.form} onSubmit={submit}>
          <label>
            분류
            <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            제목
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} required />
          </label>
          <label>
            내용
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={500} required />
          </label>
          <Button type="submit" block>
            올리기
          </Button>
        </form>
      </Card>
    </div>
  )
}

type ItemProps = { post: Post; author: string; detail?: boolean; onOpen?: () => void }

function PostItem({ post, author, detail, onOpen }: ItemProps) {
  const { toggleLike, removePost, addComment } = useCommunityStore()
  const [showCmt, setShowCmt] = useState(!!detail)
  const [text, setText] = useState('')

  const submitComment = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    addComment(post.id, author, v)
    setText('')
  }

  return (
    <article className={cx(detail ? styles.detail : styles.post)}>
      <div className={styles.meta}>
        <span className={common.tag}>{post.cat}</span>
        {post.region && <span className={styles.loc}>📍 {post.region}</span>}
        <span>{post.author}</span>
        <span>· {relTime(post.ts)}</span>
      </div>
      {onOpen ? (
        <button type="button" className={styles.openBtn} onClick={onOpen}>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </button>
      ) : (
        <>
          <h3>{post.title}</h3>
          <p>{post.body}</p>
        </>
      )}
      <div className={styles.actions}>
        <button type="button" className={cx(styles.pbtn, post.liked && styles.liked)} onClick={() => toggleLike(post.id)} aria-pressed={post.liked} aria-label={`좋아요 ${post.likes}`}>
          ♥ {post.likes}
        </button>
        <button type="button" className={styles.pbtn} onClick={() => setShowCmt((v) => !v)} aria-expanded={showCmt} aria-label={`댓글 ${post.comments.length}개`}>
          💬 {post.comments.length}
        </button>
        {post.mine && (
          <button type="button" className={cx(styles.pbtn, styles.pdel)} onClick={() => removePost(post.id)}>
            삭제
          </button>
        )}
      </div>
      {showCmt && (
        <div className={styles.cmt}>
          {post.comments.map((c, i) => (
            <p key={i} className={styles.cmtItem}>
              <b>{c.author}</b>
              {c.text}
            </p>
          ))}
          <form className={common.inline} onSubmit={submitComment}>
            <input className={common.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="댓글을 입력하세요" maxLength={100} aria-label="댓글" />
            <Button type="submit">등록</Button>
          </form>
        </div>
      )}
    </article>
  )
}
