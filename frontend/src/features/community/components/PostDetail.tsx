import { Fragment, useMemo, useRef, useState, type FormEvent } from 'react'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import { CAT_ICON, shortRegion } from '../data/display'
import { isMockApi } from '@/features/auth'
import { useReportStore, useReported, type ReportReason } from '../reports'
import { useCommunityActions } from '../useCommunity'
import { useAuthStore } from '@/features/auth/store/authStore'
import { commentCountOf, isMine, type Comment, type Post } from '../types'
import styles from './Community.module.css'
import { Attachments, PostComposer } from './PostEditor'
import { ReportDialog } from './ReportDialog'

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
  const actions = useCommunityActions()
  const [actionError, setActionError] = useState('')
  /** 서버 동작이 실패하면 문구를 보여 줌 */
  const act = async (work: Promise<string | null>) => {
    const problem = await work
    setActionError(problem ?? '')
    return problem
  }
  const userId = useAuthStore((s) => s.user?.id)
  const postMine = isMine(post, userId)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  /** 답글을 달 댓글의 순서 (없으면 새 댓글) */
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const commentInput = useRef<HTMLInputElement>(null)
  const [editCmt, setEditCmt] = useState<{ index: number; text: string } | null>(null)
  // 신고: 대상(글 또는 몇 번째 댓글) · 접수 안내
  const [reportTarget, setReportTarget] = useState<{ index?: number } | null>(null)
  const [reportNote, setReportNote] = useState('')
  const localPostReported = useReported(author, { targetType: 'POST', postId: post.id })
  const myReports = useReportStore((s) => s.reports)
  const postReported = isMockApi ? localPostReported : !!post.reported
  const commentReported = (i: number) =>
    isMockApi
      ? myReports.some((r) => r.reporter === author && r.targetType === 'COMMENT' && r.postId === post.id && r.commentIndex === i)
      : !!post.comments[i]?.reported
  const sendReport = async (reason: ReportReason, detail: string) => {
    if (!reportTarget) return
    const problem = await actions.report(post, reportTarget.index, reason, detail, author)
    setReportTarget(null)
    setReportNote(!problem ? '🚨 신고가 접수됐어요. 운영자가 확인한 뒤 처리할게요.' : problem === 'DUPLICATE' ? '🚨 이미 신고한 내용이에요.' : `🚨 ${problem}`)
  }

  const submitComment = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v || locked) return
    void act(actions.addComment(post, author, v, replyTo ?? undefined)).then((problem) => {
      if (problem) return
      setText('')
      setReplyTo(null)
    })
  }
  const remove = () => {
    if (!window.confirm('이 게시글을 삭제할까요?')) return
    void act(actions.removePost(post)).then((problem) => !problem && onDeleted())
  }

  // 댓글 묶음: 맨 위 댓글 + 그 답글들 (등록 순서). 단 댓글이 없어진 답글은 그 번호로 따로 묶음. 댓글이 바뀔 때만 한 번 훑어 계산
  const groups = useMemo(() => {
    type Item = { c: Comment; i: number }
    const known = new Set(post.comments.map((c) => c.id).filter(Boolean))
    const repliesOf = new Map<string, Item[]>()
    post.comments.forEach((c, i) => {
      if (!c.parentId) return
      const list = repliesOf.get(c.parentId)
      if (list) list.push({ c, i })
      else repliesOf.set(c.parentId, [{ c, i }])
    })
    const result: Array<{ key: string; top: Item | null; replies: Item[] }> = []
    post.comments.forEach((c, i) => {
      if (!c.parentId) result.push({ key: c.id ?? `i${i}`, top: { c, i }, replies: (c.id && repliesOf.get(c.id)) || [] })
      else if (!known.has(c.parentId) && repliesOf.has(c.parentId)) {
        result.push({ key: `gone-${c.parentId}`, top: null, replies: repliesOf.get(c.parentId)! })
        repliesOf.delete(c.parentId)
      }
    })
    return result
  }, [post.comments])
  const canReply = verified && !locked
  const startReply = (i: number) => {
    setReplyTo(i)
    setEditCmt(null)
    commentInput.current?.focus()
  }

  function renderComment(c: Comment, i: number, reply: boolean) {
    const mine = !c.staff && isMine(c, userId)
    return (
      <li key={c.id ?? i} className={cx(styles.comment, reply && styles.reply)}>
        <NameAvatar name={c.author} size={30} />
        <div className={styles.commentMain}>
          <b>
            {c.author}
            {c.staff && <span className={styles.staffTag}>운영자</span>}
          </b>
          {editCmt?.index === i ? (
            <form
              className={styles.commentEdit}
              onSubmit={(e) => {
                e.preventDefault()
                const v = editCmt.text.trim()
                if (!v || locked) return
                void act(actions.updateComment(post, i, v)).then((problem) => !problem && setEditCmt(null))
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
        {canReply && editCmt?.index !== i && (
          <span className={styles.commentBtns}>
            <button type="button" onClick={() => startReply(i)} aria-label={`${c.author} 댓글에 답글`}>
              답글
            </button>
          </span>
        )}
        {!mine && !c.staff && (
          <span className={styles.commentBtns}>
            <button type="button" className={styles.danger} onClick={() => setReportTarget({ index: i })} disabled={commentReported(i)} aria-label={`${c.author} 댓글 신고`}>
              {commentReported(i) ? '신고됨' : '🚨 신고'}
            </button>
          </span>
        )}
        {mine && editCmt?.index !== i && (
          <span className={styles.commentBtns}>
            <button type="button" onClick={() => setEditCmt({ index: i, text: c.text })} disabled={locked}>
              수정
            </button>
            <button type="button" className={styles.danger} onClick={() => void act(actions.removeComment(post, i))} disabled={locked}>
              삭제
            </button>
          </span>
        )}
      </li>
    )
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
        {!postMine && (
          <div className={styles.ownerBtns}>
            <button type="button" className={styles.danger} onClick={() => setReportTarget({})} disabled={postReported} aria-label="이 글 신고">
              {postReported ? '신고됨' : '🚨 신고'}
            </button>
          </div>
        )}
        {postMine && (
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

      {actionError && (
        <p className={styles.reportNote} role="alert">
          {actionError}
        </p>
      )}
      {reportNote && (
        <p className={styles.reportNote} role="status">
          {reportNote}
        </p>
      )}
      <span className={styles.topicTag}>
        {CAT_ICON[post.cat]} {post.cat}
      </span>
      <h1 className={styles.detailTitle}>{post.title}</h1>
      <p className={styles.detailBody}>{post.body}</p>
      {!!post.attachments?.length && <Attachments files={post.attachments} />}

      <div className={styles.reactions}>
        <button type="button" className={cx(styles.likeBtn, post.liked && styles.on)} onClick={() => (verified ? void act(actions.toggleLike(post)) : onVerify())} disabled={locked} aria-pressed={post.liked}>
          {post.liked ? '♥' : '♡'} 공감 {post.likes}
        </button>
        <span className={styles.cmtCount}>💬 댓글 {commentCountOf(post)}</span>
      </div>

      {/* 댓글: 맨 위 댓글 아래에 답글을 들여 써서 묶음으로. 단 댓글이 지워진 답글은 "삭제된 댓글" 아래로 */}
      <ul className={styles.comments}>
        {groups.map((g) => (
          <Fragment key={g.key}>
            {g.top ? renderComment(g.top.c, g.top.i, false) : <li className={cx(styles.comment, styles.deletedComment)}>삭제된 댓글이에요.</li>}
            {g.replies.map(({ c, i }) => renderComment(c, i, true))}
          </Fragment>
        ))}
        {!post.comments.length && <li className={styles.noComment}>첫 댓글을 남겨 보세요.</li>}
      </ul>

      {!verified && !locked ? (
        <button type="button" className={styles.verifyBar} onClick={onVerify}>
          📍 동네 인증하고 댓글 남기기
        </button>
      ) : (
        <form className={styles.commentBar} onSubmit={submitComment}>
          {replyTo !== null && post.comments[replyTo] && (
            <span className={styles.replyChip}>
              ↳ {post.comments[replyTo].author}님에게 답글
              <button type="button" onClick={() => setReplyTo(null)} aria-label="답글 취소">
                ✕
              </button>
            </span>
          )}
          <input ref={commentInput} value={text} onChange={(e) => setText(e.target.value)} placeholder={locked ? '이용 정지 중이에요' : replyTo !== null ? '답글을 입력하세요' : '댓글을 입력하세요'} maxLength={100} aria-label="댓글" disabled={locked} />
          <button type="submit" disabled={locked || !text.trim()} aria-label="댓글 등록">
            ↑
          </button>
        </form>
      )}

      {reportTarget && <ReportDialog what={reportTarget.index !== undefined ? '댓글' : '글'} onClose={() => setReportTarget(null)} onSubmit={sendReport} />}

      <PostComposer open={editing} onClose={() => setEditing(false)} initial={post} locked={locked} region={post.region && shortRegion(post.region)} onSave={(draft) => actions.updatePost(post, draft)} />
    </article>
  )
}
