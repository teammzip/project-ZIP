import { useState } from 'react'
import { Button } from '@/components/ui'
import { isPending, reasonLabel, useReportStore, type Post, type Report } from '@/features/community'
import { isActive, type BanRecord } from '@/features/moderation'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import styles from './Admin.module.css'

type Filter = 'pending' | 'done' | 'all'

/** 같은 대상(글 하나 · 댓글 하나)에 들어온 신고 묶음 */
type Group = {
  key: string
  type: Report['targetType']
  post?: Post
  /** 댓글이면 지금 그 글에서 몇 번째인지 (삭제됐으면 -1) */
  commentIndex: number
  author: string
  text: string
  reports: Report[]
  pending: boolean
  gone: boolean
  latest: number
}

type Props = {
  posts: Post[]
  records: Record<string, BanRecord>
  /** 삭제 창 (경고도 줄지 고르기) */
  onDelete: (title: string, msg: string, author: string, doDelete: () => void) => void
  removePost: (id: number) => void
  removeComment: (id: number, index: number) => void
}

/** 신고 관리: 대상별로 묶어서 신고 수 · 사유 · 내용 미리보기 · 작성자 이력을 한눈에, 바로 삭제(+경고) · 문제없음 처리 */
export function AdminReports({ posts, records, onDelete, removePost, removeComment }: Props) {
  const reports = useReportStore((s) => s.reports)
  const resolve = useReportStore((s) => s.resolve)
  const [filter, setFilter] = useState<Filter>('pending')
  const [openKey, setOpenKey] = useState<string | null>(null)

  // 대상별 묶기 (댓글은 번호가 없어서 글 + 작성자 + 내용으로 같은 댓글을 찾음)
  const map = new Map<string, Group>()
  for (const r of reports) {
    const key = r.targetType === 'POST' ? `P${r.postId}` : `C${r.postId}|${r.targetAuthor}|${r.targetText}`
    let g = map.get(key)
    if (!g) {
      const post = posts.find((p) => p.id === r.postId)
      const commentIndex = r.targetType === 'COMMENT' && post ? post.comments.findIndex((c) => c.author === r.targetAuthor && c.text === r.targetText) : -1
      g = { key, type: r.targetType, post, commentIndex, author: r.targetAuthor, text: r.targetText, reports: [], pending: false, gone: !post || (r.targetType === 'COMMENT' && commentIndex < 0), latest: 0 }
      map.set(key, g)
    }
    g.reports.push(r)
    g.pending ||= isPending(r)
    g.latest = Math.max(g.latest, r.at)
  }
  const groups = [...map.values()]
  const pendingCount = groups.filter((g) => g.pending).length
  const list = groups
    .filter((g) => (filter === 'pending' ? g.pending : filter === 'done' ? !g.pending : true))
    .sort((a, b) => Number(b.pending) - Number(a.pending) || b.reports.length - a.reports.length || b.latest - a.latest)

  const sameTarget = (g: Group) => (r: Report) => (g.type === 'POST' ? r.targetType === 'POST' && r.postId === g.post?.id : `C${r.postId}|${r.targetAuthor}|${r.targetText}` === g.key)
  const remove = (g: Group) => {
    if (!g.post) return
    const post = g.post
    if (g.type === 'POST') onDelete('글 삭제', `"${post.title}" 글을 삭제할까요? 댓글도 함께 사라지고 되돌릴 수 없어요.`, g.author, () => removePost(post.id))
    else onDelete('댓글 삭제', `"${g.text}" 댓글을 삭제할까요? 되돌릴 수 없어요.`, g.author, () => removeComment(post.id, g.commentIndex))
  }

  return (
    <main className={styles.pane}>
      <div className={styles.tools}>
        <div className={styles.seg} role="tablist" aria-label="신고 보기">
          {(
            [
              ['pending', `처리 대기 ${pendingCount}`],
              ['done', `처리 완료 ${groups.length - pendingCount}`],
              ['all', `전체 ${groups.length}`],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={filter === v} className={cx(filter === v && styles.on)} onClick={() => setFilter(v)}>
              {label}
            </button>
          ))}
        </div>
        <span className={styles.sub}>같은 글 · 댓글에 들어온 신고는 하나로 묶여요. 신고가 많은 것부터 보여요.</span>
      </div>

      <div className={styles.reportList}>
        {list.map((g) => {
          const rec = records[g.author]
          const reasons = Object.entries(
            g.reports.reduce<Record<string, number>>((acc, r) => {
              acc[r.reason] = (acc[r.reason] ?? 0) + 1
              return acc
            }, {}),
          ).sort((a, b) => b[1] - a[1])
          const status = g.pending ? null : g.reports.some((r) => r.status === 'HIDDEN') ? '삭제함' : '문제없음'
          const open = openKey === g.key
          return (
            <article key={g.key} className={cx(styles.reportCard, !g.pending && styles.reportDone)}>
              <div className={styles.reportHead}>
                <span className={styles.badge}>{g.type === 'POST' ? '글' : '댓글'}</span>
                <b className={styles.reportCount}>🚨 신고 {g.reports.length}건</b>
                {reasons.map(([code, n]) => (
                  <span key={code} className={cx(styles.badge, styles.ban)}>
                    {reasonLabel(code as Report['reason'])} {n > 1 && `×${n}`}
                  </span>
                ))}
                <span className={styles.reportTime}>{relTime(g.latest)}</span>
                {status && <span className={cx(styles.badge, styles.ok)}>{status}</span>}
              </div>

              <div className={styles.reportTarget}>
                {g.type === 'POST' ? (
                  <>
                    <b>{g.post?.title ?? g.text}</b>
                    {g.post && <p>{g.post.body}</p>}
                  </>
                ) : (
                  <>
                    <b>&ldquo;{g.text}&rdquo;</b>
                    <p>글: {g.post?.title ?? '(삭제된 글)'}</p>
                  </>
                )}
                {g.gone && g.pending && <p className={styles.hot}>이미 삭제된 내용이에요.</p>}
              </div>

              <div className={styles.reportMeta}>
                작성자 <b>{g.author}</b> · 경고 {rec?.warns ?? 0}회 · 정지 {rec?.count ?? 0}회 {isActive(rec) && <span className={cx(styles.badge, styles.ban)}>정지 중</span>}
                <button type="button" className={styles.linkBtn} onClick={() => setOpenKey(open ? null : g.key)} aria-expanded={open}>
                  신고 내용 {open ? '접기' : '보기'}
                </button>
              </div>

              {open && (
                <ul className={styles.reporters}>
                  {g.reports.map((r) => (
                    <li key={r.id}>
                      <b>{r.reporter}</b> · {reasonLabel(r.reason)}
                      {r.detail && <span> — {r.detail}</span>}
                      <small> · {relTime(r.at)}</small>
                    </li>
                  ))}
                </ul>
              )}

              {g.pending && (
                <div className={styles.reportActions}>
                  {g.gone ? (
                    <Button variant="line" onClick={() => resolve(sameTarget(g), 'HIDDEN')}>
                      처리 완료로
                    </Button>
                  ) : (
                    <>
                      <Button variant="line" onClick={() => resolve(sameTarget(g), 'DISMISSED')}>
                        문제없음
                      </Button>
                      <Button variant="danger" onClick={() => remove(g)}>
                        {g.type === 'POST' ? '글 삭제' : '댓글 삭제'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </article>
          )
        })}
        {!list.length && <p className={styles.empty}>{filter === 'pending' ? '처리할 신고가 없어요 👍' : '신고 내역이 없어요.'}</p>}
      </div>
    </main>
  )
}
