import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { ReportDialog, type ReportReason } from '@/features/community'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { reviewApi, reviewKeys, useInvalidateReviews, type PlaceReview } from '../reviews'
import styles from './PlaceReviews.module.css'

/* 장소 리뷰 (GET · POST /api/places/{id}/reviews, PUT · DELETE …/reviews/mine, POST …/reviews/{리뷰}/reports).
 * 별점 1~5 + 한 줄 후기(300자), 한 사람당 한 장소 하나. 우리 회원 리뷰는 우리 서버에만 저장돼요 (카카오 장소는 id · 이름만 같이).
 * 내 리뷰는 고치기 · 지우기, 다른 사람 리뷰는 신고(운영자가 확인해 지우거나 기각). */

const MAX_BODY = 300

const dateText = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} style={{ fontSize: size }} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? styles.starOn : undefined} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  )
}

/** 별점 고르기 + 내용 쓰기 (새 리뷰 · 고치기 같이 씀) */
function ReviewForm({ initial, pending, error, submitLabel, onSubmit, onCancel }: {
  initial?: { rating: number; body: string }
  pending: boolean
  error: string
  submitLabel: string
  onSubmit: (rating: number, body: string) => void
  onCancel?: () => void
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [body, setBody] = useState(initial?.body ?? '')
  const [localError, setLocalError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (rating < 1) return setLocalError('별점을 골라 주세요.')
    setLocalError('')
    onSubmit(rating, body.trim())
  }

  const shown = localError || error
  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.pick} role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}점`}
            className={cx(styles.pickStar, n <= rating && styles.starOn)}
            onClick={() => {
              setRating(n)
              setLocalError('')
            }}
          >
            ★
          </button>
        ))}
        <span className={styles.muted}>{rating ? `${rating}점` : '별점을 눌러 주세요'}</span>
      </div>
      <textarea
        className={styles.body}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_BODY}
        rows={3}
        placeholder="이 장소 어땠나요? (선택, 300자까지)"
        aria-label="리뷰 내용"
      />
      <div className={styles.formFoot}>
        <small className={styles.muted}>
          {body.length}/{MAX_BODY}
          {!initial && ' · 한 장소에 하나만 쓸 수 있어요'}
        </small>
        <span className={styles.formBtns}>
          {onCancel && (
            <Button type="button" variant="line" onClick={onCancel}>
              취소
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? '저장 중…' : submitLabel}
          </Button>
        </span>
      </div>
      {shown && (
        <p className={styles.error} role="alert">
          {shown}
        </p>
      )}
    </form>
  )
}

export function PlaceReviews({ placeId, placeName }: { placeId: string; placeName: string }) {
  const me = useAuthStore((s) => s.user)
  const meRef = me ? { id: me.id, nickname: me.nickname } : undefined
  const invalidate = useInvalidateReviews()
  const reviews = useQuery({ queryKey: reviewKeys.place(placeId), queryFn: () => reviewApi.reviews(placeId, meRef), staleTime: 30_000 })
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reporting, setReporting] = useState<PlaceReview | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('') // 쓰기 · 고치기 창 아래
  const [topError, setTopError] = useState('') // 지우기 · 신고

  const done = (message: string) => {
    setError('')
    setTopError('')
    setNotice(message)
    setEditing(false)
    setConfirmDelete(false)
    void invalidate()
  }
  const failed = (e: unknown) => setError(getErrorMessage(e, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))

  const add = useMutation({
    mutationFn: (v: { rating: number; body: string }) => reviewApi.add(placeId, placeName, v.rating, v.body, meRef),
    onSuccess: () => done('리뷰를 남겼어요.'),
    onError: failed,
  })
  const update = useMutation({
    mutationFn: (v: { rating: number; body: string }) => reviewApi.update(placeId, v.rating, v.body, meRef),
    onSuccess: () => done('리뷰를 고쳤어요.'),
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: () => reviewApi.remove(placeId, meRef),
    onSuccess: () => done('리뷰를 지웠어요.'),
    onError: (e) => setTopError(getErrorMessage(e, '지우지 못했어요. 잠시 후 다시 시도해 주세요.')),
  })
  const report = useMutation({
    mutationFn: (v: { reviewId: string; reason: ReportReason; detail: string }) => reviewApi.report(placeId, v.reviewId, v.reason, v.detail, meRef),
    onSuccess: () => {
      setReporting(null)
      done('신고했어요. 운영자가 확인한 뒤 처리해요.')
    },
    onError: (e) => {
      setReporting(null)
      setNotice('')
      setTopError(getErrorMessage(e, '신고하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    },
  })

  const list = reviews.data ?? []
  const avg = list.length ? Math.round((list.reduce((sum, r) => sum + r.rating, 0) / list.length) * 10) / 10 : 0
  const mine = list.find((r) => r.author.id === me?.id)

  return (
    <section className={styles.root} aria-label="리뷰">
      <div className={styles.head}>
        <h3 className={styles.title}>
          리뷰 <span className={styles.count}>{list.length}</span>
        </h3>
        {list.length > 0 && (
          <span className={styles.avg}>
            <Stars value={avg} /> <b>{avg.toFixed(1)}</b>
          </span>
        )}
      </div>
      <p className={styles.muted}>ZIP 회원이 남긴 리뷰예요.</p>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {topError && (
        <p className={styles.error} role="alert">
          {topError}
        </p>
      )}

      {!mine && !reviews.isLoading && !reviews.isError && (
        <ReviewForm key="new" pending={add.isPending} error={error} submitLabel="리뷰 남기기" onSubmit={(rating, body) => add.mutate({ rating, body })} />
      )}

      {reviews.isLoading ? (
        <p className={styles.muted}>리뷰를 불러오는 중…</p>
      ) : reviews.isError ? (
        <p className={styles.muted}>리뷰를 불러오지 못했어요.</p>
      ) : list.length === 0 ? (
        <p className={styles.muted}>아직 리뷰가 없어요. 첫 리뷰를 남겨 주세요.</p>
      ) : (
        <ul className={styles.list}>
          {list.map((r) => {
            const isMine = r.author.id === me?.id
            if (isMine && editing) {
              return (
                <li key={r.id} className={styles.item}>
                  <ReviewForm
                    key={`edit-${r.id}`}
                    initial={{ rating: r.rating, body: r.body }}
                    pending={update.isPending}
                    error={error}
                    submitLabel="고친 내용 저장"
                    onSubmit={(rating, body) => update.mutate({ rating, body })}
                    onCancel={() => {
                      setEditing(false)
                      setError('')
                    }}
                  />
                </li>
              )
            }
            return (
              <li key={r.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <b>{r.author.nickname}</b>
                  {isMine && <span className={styles.mine}>내 리뷰</span>}
                  <Stars value={r.rating} size={12} />
                  <small className={styles.muted}>{dateText(r.createdAt)}</small>
                  <span className={styles.itemActions}>
                    {isMine ? (
                      confirmDelete ? (
                        <>
                          <span className={styles.muted}>지울까요?</span>
                          <button type="button" className={cx(styles.linkBtn, styles.danger)} disabled={remove.isPending} onClick={() => remove.mutate()}>
                            지우기
                          </button>
                          <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(false)}>
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() => {
                              setNotice('')
                              setError('')
                              setEditing(true)
                            }}
                          >
                            고치기
                          </button>
                          <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(true)}>
                            지우기
                          </button>
                        </>
                      )
                    ) : r.reportedByMe ? (
                      <span className={styles.muted}>신고함</span>
                    ) : (
                      <button type="button" className={styles.linkBtn} onClick={() => setReporting(r)}>
                        신고
                      </button>
                    )}
                  </span>
                </div>
                {r.body && <p className={styles.text}>{r.body}</p>}
              </li>
            )
          })}
        </ul>
      )}

      {reporting && (
        <ReportDialog what="리뷰" onClose={() => setReporting(null)} onSubmit={(reason, detail) => report.mutate({ reviewId: reporting.id, reason, detail })} />
      )}
    </section>
  )
}

/** 지도 목록의 작은 별점: ★4.0 (2) */
export function RatingBadge({ rating, count }: { rating: number; count: number }) {
  return (
    <span className={styles.badge} aria-label={`별점 ${rating.toFixed(1)}점, 리뷰 ${count}개`}>
      <i aria-hidden="true">★</i>
      {rating.toFixed(1)}
      <small>({count})</small>
    </span>
  )
}
