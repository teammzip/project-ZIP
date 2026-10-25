import { useState, type FormEvent } from 'react'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import { CAT_ICON, shortRegion } from '../data/display'
import { useCommunityStore } from '../store'
import type { Post } from '../types'
import styles from './Community.module.css'
import { Attachments, PostComposer } from './PostEditor'

/** 이름 첫 글자 동그라미 (이름마다 색이 정해짐) */
export function NameAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = [...name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % 360
  return (
    <span className={styles.nameAva} style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 45% 38%)` }} aria-hidden="true">
      {name.charAt(0)}
    </span>
  )
}

type Props = {
  post: Post
  author: string
  locked: boolean
  /** 동네 인증을 했는지 (안 했으면 댓글 · 공감 대신 인증 창) */
  verified: boolean
  onVerify: () => void
  onBack: () => void
  onDeleted: () => void
}

/** 글 상세 (에브리타임처럼): 작성자 줄 → 제목 · 본문 → 사진 → 공감 · 댓글 수 → 댓글 → 아래 댓글 입력줄. 내 글이면 수정 · 삭제 */
export function PostDetail({ post, author, locked, verified, onVerify, onBack, onDeleted }: Props) {
  const { toggleLike, removePost, updatePost, addComment, updateComment, removeComment } = useCommunityStore()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [editCmt, setEditCmt] = useState<{ index: number; text: string } | null>(null)

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
    onDeleted()
  }

  return (
    <article className={styles.detail}>
      <button type="button" className={styles.back} onClick={onBack}>
        ‹ 동네생활
      </button>

      <div className={styles.author}>
        <NameAvatar name={post.author} size={42} />
        <div className={styles.authorText}>
          <b>{post.author}</b>
          <small>
            {post.region && `${shortRegion(post.region)} · `}
            {relTime(post.ts)}
          </small>
        </div>
        {post.mine && (
          <div className={styles.ownerBtns}>
            <button type="button" onClick={() => setEditing(true)} disabled={locked}>
              수정
            </button>
            <button type="button" className={styles.danger} onClick={remove} disabled={locked}>
              삭제
            </button>
          </div>
        )}
      </div>

      <span className={styles.topicTag}>
        {CAT_ICON[post.cat]} {post.cat}
      </span>
      <h1 className={styles.detailTitle}>{post.title}</h1>
      <p className={styles.detailBody}>{post.body}</p>
      {!!post.attachments?.length && <Attachments files={post.attachments} />}

      <div className={styles.reactions}>
        <button type="button" className={cx(styles.likeBtn, post.liked && styles.on)} onClick={() => (verified ? toggleLike(post.id) : onVerify())} disabled={locked} aria-pressed={post.liked}>
          {post.liked ? '♥' : '♡'} 공감 {post.likes}
        </button>
        <span className={styles.cmtCount}>💬 댓글 {post.comments.length}</span>
      </div>

      {/* 댓글 */}
      <ul className={styles.comments}>
        {post.comments.map((c, i) => {
          const mine = c.mine || c.author === author
          return (
            <li key={i} className={styles.comment}>
              <NameAvatar name={c.author} size={30} />
              <div className={styles.commentMain}>
                <b>{c.author}</b>
                {editCmt?.index === i ? (
                  <form
                    className={styles.commentEdit}
                    onSubmit={(e) => {
                      e.preventDefault()
                      const v = editCmt.text.trim()
                      if (!v || locked) return
                      updateComment(post.id, i, v)
                      setEditCmt(null)
                    }}
                  >
                    <input value={editCmt.text} onChange={(e) => setEditCmt({ index: i, text: e.target.value })} maxLength={100} aria-label="댓글 수정" autoFocus />
                    <button type="submit">저장</button>
                    <button type="button" onClick={() => setEditCmt(null)}>
                      취소
                    </button>
                  </form>
                ) : (
                  <p>{c.text}</p>
                )}
              </div>
              {mine && editCmt?.index !== i && (
                <span className={styles.commentBtns}>
                  <button type="button" onClick={() => setEditCmt({ index: i, text: c.text })} disabled={locked}>
                    수정
                  </button>
                  <button type="button" className={styles.danger} onClick={() => removeComment(post.id, i)} disabled={locked}>
                    삭제
                  </button>
                </span>
              )}
            </li>
          )
        })}
        {!post.comments.length && <li className={styles.noComment}>첫 댓글을 남겨 보세요.</li>}
      </ul>

      {!verified && !locked ? (
        <button type="button" className={styles.verifyBar} onClick={onVerify}>
          📍 동네 인증하고 댓글 남기기
        </button>
      ) : (
        <form className={styles.commentBar} onSubmit={submitComment}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={locked ? '이용 정지 중이에요' : '댓글을 입력하세요'} maxLength={100} aria-label="댓글" disabled={locked} />
          <button type="submit" disabled={locked || !text.trim()} aria-label="댓글 등록">
            ↑
          </button>
        </form>
      )}

      <PostComposer open={editing} onClose={() => setEditing(false)} initial={post} locked={locked} region={post.region && shortRegion(post.region)} onSave={(draft) => updatePost(post.id, draft)} />
    </article>
  )
}
