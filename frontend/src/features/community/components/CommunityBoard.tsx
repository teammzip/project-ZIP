import { useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, Segmented } from '@/components/ui'
import { banMessage, useActiveBan } from '@/features/moderation'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import common from '@/styles/common.module.css'
import { checkAttachments, MAX_ATTACHMENTS, readAttachments, STORAGE_FULL } from '../attachments'
import { CATEGORIES, NEARBY } from '../data/seed'
import { useCommunityStore } from '../store'
import type { Attachment, Post, PostDraft } from '../types'
import styles from './Community.module.css'

type Scope = 'here' | 'near' | 'all'

type Props = {
  /** 우리 동네 (내 정보에서 설정) */
  region: string
  /** 글·댓글 작성자 이름 */
  author: string
  /** 내 아이디 (이용 정지 확인용) */
  uid?: string
}

/** 커뮤니티: 동네 범위 · 분류로 글 목록 보기, 글 상세(?post=id), 좋아요 · 댓글 · 글쓰기,
 * 내 글 · 댓글 수정 · 삭제, 사진 · 파일 첨부 (백엔드 담당 시안 PR #15). 이용 정지 중이면 쓰기 동작을 막음 */
export function CommunityBoard({ region, author, uid }: Props) {
  const { posts, addPost } = useCommunityStore()
  const ban = useActiveBan(author, uid)
  const [params, setParams] = useSearchParams()
  const [scope, setScope] = useState<Scope>('here')
  const [cat, setCat] = useState('전체')
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
  const locked = !!ban

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
        {ban && (
          <p className={cx(common.notice, styles.banNotice)} role="alert">
            {banMessage(ban)} 정지 중에는 글쓰기 · 댓글 · 좋아요를 할 수 없어요.
          </p>
        )}
        {selected ? (
          <>
            <Button variant="line" className={styles.back} onClick={() => open(null)}>
              ‹ 목록으로
            </Button>
            <PostItem post={selected} author={author} locked={locked} detail onDeleted={() => open(null)} />
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
              <PostItem key={p.id} post={p} author={author} locked={locked} onOpen={() => open(p.id)} />
            ))}
            {!items.length && <p className={common.empty}>아직 글이 없어요. 첫 글을 써보세요!</p>}
          </>
        )}
      </Card>

      <Card title="글쓰기" actions={region && <span className={styles.loc}>📍 {region}</span>}>
        <PostEditor
          locked={locked}
          submitLabel="올리기"
          onSave={(draft) => {
            const ok = addPost({ ...draft, region: region || '서울 마포구', author })
            if (ok) {
              setCat('전체')
              setScope('here')
              open(null)
            }
            return ok
          }}
        />
      </Card>
    </div>
  )
}

type EditorProps = {
  initial?: Post
  locked?: boolean
  submitLabel: string
  /** 저장 공간이 부족해 실패하면 false */
  onSave: (draft: PostDraft) => boolean
  onCancel?: () => void
}

/** 글 쓰기 · 고치기 폼: 분류 · 제목 · 내용 · 첨부(최대 5개, 합계 2MB). 고칠 때는 기존 첨부를 뺄 수 있음 */
function PostEditor({ initial, locked, submitLabel, onSave, onCancel }: EditorProps) {
  const [form, setForm] = useState({ cat: initial?.cat ?? CATEGORIES[0], title: initial?.title ?? '', body: initial?.body ?? '' })
  const [kept, setKept] = useState<Attachment[]>(initial?.attachments ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (locked) return
    setError('')
    const title = form.title.trim()
    const body = form.body.trim()
    if (!title || !body) return setError('제목과 내용을 입력해 주세요.')
    const files = Array.from(fileInput.current?.files ?? [])
    const problem = checkAttachments(kept, files)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      const added = await readAttachments(files)
      if (!onSave({ cat: form.cat, title, body, attachments: [...kept, ...added] })) return setError(STORAGE_FULL)
      if (!initial) {
        // 새 글을 올렸으면 폼 비우기
        setForm({ cat: CATEGORIES[0], title: '', body: '' })
        setKept([])
        if (fileInput.current) fileInput.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '첨부 파일을 처리하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={common.form} onSubmit={submit}>
      <label>
        분류
        <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} disabled={locked}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        제목
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} required disabled={locked} />
      </label>
      <label>
        내용
        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={500} required disabled={locked} />
      </label>
      {kept.length > 0 && (
        <Attachments
          files={kept}
          onRemove={(i) => {
            setKept(kept.filter((_, j) => j !== i))
          }}
        />
      )}
      <label>
        사진 · 파일 첨부
        <input ref={fileInput} type="file" multiple disabled={locked} />
        <small className={styles.hint}>최대 {MAX_ATTACHMENTS}개, 합계 2MB까지 올릴 수 있어요.</small>
      </label>
      {error && (
        <p className={common.formError} role="alert">
          {error}
        </p>
      )}
      <div className={common.actions}>
        <Button type="submit" loading={busy} disabled={locked} className={styles.grow}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="line" onClick={onCancel}>
            취소
          </Button>
        )}
      </div>
    </form>
  )
}

/** 첨부 보기: 사진은 바로 보이고, 다른 파일은 내려받기 링크. onRemove 가 있으면 "첨부 삭제" 버튼 */
function Attachments({ files, onRemove }: { files: Attachment[]; onRemove?: (index: number) => void }) {
  return (
    <div className={styles.attachments}>
      {files.map((f, i) => {
        const valid = f.data.startsWith('data:')
        return (
          <div key={`${f.name}-${i}`} className={styles.attachment}>
            {valid && f.type.startsWith('image/') && <img src={f.data} alt={f.name} />}
            {valid ? (
              <a href={f.data} download={f.name}>
                {f.name}
              </a>
            ) : (
              <span>{f.name}</span>
            )}
            {onRemove && (
              <button type="button" className={cx(styles.pbtn, styles.pdel)} onClick={() => onRemove(i)}>
                첨부 삭제
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

type ItemProps = { post: Post; author: string; locked: boolean; detail?: boolean; onOpen?: () => void; onDeleted?: () => void }

function PostItem({ post, author, locked, detail, onOpen, onDeleted }: ItemProps) {
  const { toggleLike, removePost, updatePost, addComment, updateComment, removeComment } = useCommunityStore()
  const [showCmt, setShowCmt] = useState(!!detail)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [editCmt, setEditCmt] = useState<{ index: number; text: string } | null>(null)

  if (editing)
    return (
      <article className={cx(detail ? styles.detail : styles.post)}>
        <h3 className={styles.editTitle}>글 수정</h3>
        <PostEditor
          initial={post}
          locked={locked}
          submitLabel="수정 저장"
          onSave={(draft) => {
            const ok = updatePost(post.id, draft)
            if (ok) setEditing(false)
            return ok
          }}
          onCancel={() => setEditing(false)}
        />
      </article>
    )

  const submitComment = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v || locked) return
    addComment(post.id, author, v)
    setText('')
  }
  const remove = () => {
    if (!window.confirm('이 게시글을 삭제할까요?')) return
    removePost(post.id)
    onDeleted?.()
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
      {!!post.attachments?.length && <Attachments files={post.attachments} />}
      <div className={styles.actions}>
        <button type="button" className={cx(styles.pbtn, post.liked && styles.liked)} onClick={() => toggleLike(post.id)} disabled={locked} aria-pressed={post.liked} aria-label={`좋아요 ${post.likes}`}>
          ♥ {post.likes}
        </button>
        <button type="button" className={styles.pbtn} onClick={() => setShowCmt((v) => !v)} aria-expanded={showCmt} aria-label={`댓글 ${post.comments.length}개`}>
          💬 {post.comments.length}
        </button>
        {post.mine && (
          <>
            <button type="button" className={styles.pbtn} onClick={() => setEditing(true)} disabled={locked}>
              수정
            </button>
            <button type="button" className={cx(styles.pbtn, styles.pdel)} onClick={remove} disabled={locked}>
              삭제
            </button>
          </>
        )}
      </div>
      {showCmt && (
        <div className={styles.cmt}>
          {post.comments.map((c, i) => {
            const mine = c.mine || c.author === author
            if (editCmt?.index === i)
              return (
                <form
                  key={i}
                  className={common.inline}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const v = editCmt.text.trim()
                    if (!v || locked) return
                    updateComment(post.id, i, v)
                    setEditCmt(null)
                  }}
                >
                  <input className={common.input} value={editCmt.text} onChange={(e) => setEditCmt({ index: i, text: e.target.value })} maxLength={100} aria-label="댓글 수정" autoFocus />
                  <Button type="submit">저장</Button>
                  <Button variant="line" onClick={() => setEditCmt(null)}>
                    취소
                  </Button>
                </form>
              )
            return (
              <div key={i} className={styles.cmtItem}>
                <b>{c.author}</b>
                <span className={styles.cmtText}>{c.text}</span>
                {mine && (
                  <span className={styles.cmtActions}>
                    <button type="button" className={styles.pbtn} onClick={() => setEditCmt({ index: i, text: c.text })} disabled={locked}>
                      수정
                    </button>
                    <button type="button" className={cx(styles.pbtn, styles.pdel)} onClick={() => removeComment(post.id, i)} disabled={locked}>
                      삭제
                    </button>
                  </span>
                )}
              </div>
            )
          })}
          <form className={common.inline} onSubmit={submitComment}>
            <input className={common.input} value={text} onChange={(e) => setText(e.target.value)} placeholder={locked ? '이용 정지 중이에요' : '댓글을 입력하세요'} maxLength={100} aria-label="댓글" disabled={locked} />
            <Button type="submit" disabled={locked}>
              등록
            </Button>
          </form>
        </div>
      )}
    </article>
  )
}
