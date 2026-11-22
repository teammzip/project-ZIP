import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Modal } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { ReportDialog, type ReportReason } from '@/features/community'
import { Avatar } from '@/features/profile'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { PHOTO_BYTES, PHOTO_MAX, PHOTO_TYPES, reviewApi, reviewKeys, useInvalidateReviews, type PhotoDraft, type PlaceReview, type ReviewPhoto } from '../reviews'
import styles from './PlaceReviews.module.css'

/* 장소 리뷰 (GET · POST /api/places/{id}/reviews, PUT · DELETE …/reviews/mine, POST …/reviews/{리뷰}/reports).
 * 맨 위 평균 별점 · 후기 수, 사진 모아 보기, 리뷰 카드(프로필 · 후기 수 · 별점 평균 · ⋮ 메뉴 · 더보기 · 사진).
 * 우리 회원 리뷰는 우리 서버에만 저장돼요. 내 리뷰는 ⋮ → 수정 · 삭제, 다른 사람 리뷰는 ⋮ → 신고. */

const MAX_BODY = 300
const FIRST_SHOWN = 3
const LONG_BODY = 90

/** "2026-09-30T…" → "26.09.30." (사진 위) · "2026.09.30." (리뷰) */
const shortDate = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`
}
const longDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`
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

/** 별점 고르기 + 내용 + 사진 (새 리뷰 · 수정 같이 씀) */
function ReviewForm({ initial, pending, error, submitLabel, onSubmit, onCancel }: {
  initial?: { rating: number; body: string; photos: ReviewPhoto[] }
  pending: boolean
  error: string
  submitLabel: string
  onSubmit: (rating: number, body: string, photos: PhotoDraft[]) => void
  onCancel: () => void
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [body, setBody] = useState(initial?.body ?? '')
  const [photos, setPhotos] = useState<PhotoDraft[]>(initial?.photos.map((p) => ({ id: p.id, url: p.url })) ?? [])
  const [localError, setLocalError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const created = useRef<string[]>([])
  const discard = () => {
    if (pending) return
    void reviewApi.discardPhotos(photos)
    onCancel()
  }

  // 미리보기 주소(blob:) 정리
  useEffect(() => {
    const urls = created.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = [...(e.target.files ?? [])]
    e.target.value = ''
    const room = PHOTO_MAX - photos.length
    const ok: PhotoDraft[] = []
    let problem = ''
    for (const file of chosen) {
      if (!PHOTO_TYPES.includes(file.type)) problem = 'JPEG · PNG 사진만 올릴 수 있어요.'
      else if (file.size > PHOTO_BYTES) problem = '사진은 한 장에 2MB 이하여야 해요.'
      else if (ok.length >= room) problem = `사진은 ${PHOTO_MAX}장까지 붙일 수 있어요.`
      else {
        const url = URL.createObjectURL(file)
        created.current.push(url)
        ok.push({ url, file })
      }
    }
    setPhotos((prev) => [...prev, ...ok])
    setLocalError(problem)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (rating < 1) return setLocalError('별점을 골라 주세요.')
    setLocalError('')
    onSubmit(rating, body.trim(), photos)
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
      <div className={styles.photoPick}>
        {photos.map((p, i) => (
          <span key={p.url} className={styles.photoThumb} style={{ backgroundImage: `url("${p.url}")` }}>
            <button type="button" disabled={pending} aria-label={`사진 ${i + 1} 빼기`} onClick={() => { void reviewApi.discardPhotos([p]); setPhotos((prev) => prev.filter((x) => x !== p)) }}>
              ✕
            </button>
          </span>
        ))}
        {photos.length < PHOTO_MAX && (
          <button type="button" disabled={pending} className={styles.photoAdd} onClick={() => fileInput.current?.click()}>
            <span aria-hidden="true">📷</span>
            <small>
              {photos.length}/{PHOTO_MAX}
            </small>
          </button>
        )}
        <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(',')} multiple hidden onChange={pick} aria-label="사진 고르기" />
      </div>
      <div className={styles.formFoot}>
        <small className={styles.muted}>
          {body.length}/{MAX_BODY} · 사진은 JPEG · PNG, 한 장 2MB
        </small>
        <span className={styles.formBtns}>
          <Button type="button" variant="line" disabled={pending} onClick={discard}>
            취소
          </Button>
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

/** ⋮ 메뉴: 바깥을 누르면 닫힘 */
function MoreMenu({ items }: { items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <span ref={box} className={styles.more}>
      <button type="button" className={styles.moreBtn} aria-label="더보기 메뉴" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        ⋮
      </button>
      {open && (
        <span className={styles.menu} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cx(item.danger && styles.danger)}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
            >
              {item.label}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

/** 사진 크게 보기 (‹ › 로 넘김) */
function PhotoViewer({ photos, start, onClose }: { photos: Array<ReviewPhoto & { date?: string }>; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start)
  const photo = photos[index]
  return (
    <Modal open onClose={onClose} title={`사진 ${index + 1} / ${photos.length}`}>
      <div className={styles.viewer}>
        <img src={photo.url} alt={`리뷰 사진 ${index + 1}`} />
        {photos.length > 1 && (
          <div className={styles.viewerNav}>
            <Button variant="line" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              ‹ 이전
            </Button>
            <span className={styles.muted}>{photo.date}</span>
            <Button variant="line" disabled={index === photos.length - 1} onClick={() => setIndex(index + 1)}>
              다음 ›
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** 리뷰 하나: 프로필 · 후기 수 · 별점 평균 · ⋮, 별점 · 날짜, 내용(길면 더보기), 오른쪽 사진 */
function ReviewCard({ r, mine, onEdit, onDelete, onReport, onPhoto }: {
  r: PlaceReview
  mine: boolean
  onEdit: () => void
  onDelete: () => void
  onReport: () => void
  onPhoto: (index: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = r.body.length > LONG_BODY || r.body.split('\n').length > 3
  const a = r.author
  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <Avatar name={a.nickname} size={40} look={{ avatarImg: a.avatarUrl ?? '', avatarEmoji: a.avatarEmoji ?? '', avatarColor: a.avatarColor ?? '' }} />
        <span className={styles.who}>
          <b>
            {a.nickname}
            {mine && <span className={styles.mine}>내 리뷰</span>}
          </b>
          {a.reviewCount != null && (
            <small>
              후기 {a.reviewCount} · 별점평균 {(a.ratingAvg ?? 0).toFixed(1)}
            </small>
          )}
        </span>
        <MoreMenu
          items={
            mine
              ? [
                  { label: '수정', onClick: onEdit },
                  { label: '삭제', onClick: onDelete, danger: true },
                ]
              : [{ label: r.reportedByMe ? '신고함' : '신고', onClick: onReport, disabled: r.reportedByMe }]
          }
        />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardText}>
          <div className={styles.cardMeta}>
            <Stars value={r.rating} size={15} />
            <small className={styles.muted}>{longDate(r.createdAt)}</small>
          </div>
          {r.body && <p className={cx(styles.text, long && !expanded && styles.clamp)}>{r.body}</p>}
          {r.body && long && (
            <button type="button" className={styles.moreText} onClick={() => setExpanded(!expanded)}>
              {expanded ? '접기' : '더보기'}
            </button>
          )}
        </div>
        {r.photos.length > 0 && (
          <button type="button" className={styles.cardPhoto} style={{ backgroundImage: `url("${r.photos[0].url}")` }} onClick={() => onPhoto(0)} aria-label={`사진 ${r.photos.length}장 보기`}>
            {r.photos.length > 1 && <span>+{r.photos.length - 1}</span>}
          </button>
        )}
      </div>
    </li>
  )
}

export function PlaceReviews({ placeId, placeName, initialShowAll = false }: { placeId: string; placeName: string; initialShowAll?: boolean }) {
  const me = useAuthStore((s) => s.user)
  const meRef = me ? { id: me.id, nickname: me.nickname } : undefined
  const invalidate = useInvalidateReviews()
  const reviews = useQuery({ queryKey: reviewKeys.place(placeId), queryFn: () => reviewApi.reviews(placeId, meRef), staleTime: 30_000 })
  const [writing, setWriting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showAll, setShowAll] = useState(initialShowAll)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reporting, setReporting] = useState<PlaceReview | null>(null)
  const [viewer, setViewer] = useState<{ photos: Array<ReviewPhoto & { date?: string }>; start: number } | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('') // 쓰기 · 수정 창 아래
  const [topError, setTopError] = useState('') // 삭제 · 신고

  const done = (message: string) => {
    setError('')
    setTopError('')
    setNotice(message)
    setWriting(false)
    setEditing(false)
    setConfirmDelete(false)
    void invalidate()
  }
  const failed = (e: unknown) => setError(getErrorMessage(e, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'))

  const add = useMutation({
    mutationFn: (v: { rating: number; body: string; photos: PhotoDraft[] }) => reviewApi.add(placeId, placeName, v.rating, v.body, v.photos, meRef),
    onSuccess: () => done('리뷰를 남겼어요.'),
    onError: failed,
  })
  const update = useMutation({
    mutationFn: (v: { rating: number; body: string; photos: PhotoDraft[] }) => reviewApi.update(placeId, v.rating, v.body, v.photos, meRef),
    onSuccess: () => done('리뷰를 수정했어요.'),
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: () => reviewApi.remove(placeId, meRef),
    onSuccess: () => done('리뷰를 삭제했어요.'),
    onError: (e) => {
      setConfirmDelete(false)
      setTopError(getErrorMessage(e, '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'))
    },
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
  // 맨 위 사진 줄: 최신 리뷰부터 모든 사진
  const allPhotos = list.flatMap((r) => r.photos.map((p) => ({ ...p, date: shortDate(r.createdAt) })))
  const shown = showAll ? list : list.slice(0, FIRST_SHOWN)

  return (
    <section className={styles.root} aria-label="리뷰">
      <div className={styles.head}>
        <span className={styles.score}>
          <b>{avg.toFixed(1)}</b>
          <Stars value={avg} size={22} />
        </span>
        <button type="button" className={styles.countBtn} onClick={() => setShowAll(!showAll)} disabled={list.length <= FIRST_SHOWN} aria-expanded={showAll}>
          후기 {list.length} {list.length > FIRST_SHOWN && <span aria-hidden="true">{showAll ? '⌃' : '›'}</span>}
        </button>
      </div>

      {allPhotos.length > 0 && (
        <div className={styles.strip}>
          {allPhotos.map((p, i) => (
            <button key={p.id} type="button" className={styles.stripPhoto} style={{ backgroundImage: `url("${p.url}")` }} onClick={() => setViewer({ photos: allPhotos, start: i })} aria-label={`리뷰 사진 ${i + 1} 크게 보기`}>
              <span>{p.date}</span>
            </button>
          ))}
        </div>
      )}

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

      {!mine && !reviews.isLoading && !reviews.isError && (writing ? (
        <ReviewForm
          key="new"
          pending={add.isPending}
          error={error}
          submitLabel="리뷰 남기기"
          onSubmit={(rating, body, photos) => add.mutate({ rating, body, photos })}
          onCancel={() => {
            setWriting(false)
            setError('')
          }}
        />
      ) : (
        <Button
          variant="line"
          className={styles.writeBtn}
          onClick={() => {
            setNotice('')
            setWriting(true)
          }}
        >
          ✍ 리뷰 쓰기
        </Button>
      ))}

      {reviews.isLoading ? (
        <p className={styles.muted}>리뷰를 불러오는 중…</p>
      ) : reviews.isError ? (
        <p className={styles.muted}>리뷰를 불러오지 못했어요.</p>
      ) : list.length === 0 ? (
        <p className={styles.muted}>아직 리뷰가 없어요. ZIP 회원 첫 리뷰를 남겨 주세요.</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((r) => {
            const isMine = r.author.id === me?.id
            if (isMine && editing) {
              return (
                <li key={r.id} className={styles.card}>
                  <ReviewForm
                    key={`edit-${r.id}`}
                    initial={{ rating: r.rating, body: r.body, photos: r.photos }}
                    pending={update.isPending}
                    error={error}
                    submitLabel="수정 완료"
                    onSubmit={(rating, body, photos) => update.mutate({ rating, body, photos })}
                    onCancel={() => {
                      setEditing(false)
                      setError('')
                    }}
                  />
                </li>
              )
            }
            return (
              <ReviewCard
                key={r.id}
                r={r}
                mine={isMine}
                onEdit={() => {
                  setNotice('')
                  setError('')
                  setEditing(true)
                }}
                onDelete={() => setConfirmDelete(true)}
                onReport={() => setReporting(r)}
                onPhoto={(start) => setViewer({ photos: r.photos.map((p) => ({ ...p, date: shortDate(r.createdAt) })), start })}
              />
            )
          })}
        </ul>
      )}
      {!showAll && list.length > FIRST_SHOWN && (
        <Button variant="line" className={styles.writeBtn} onClick={() => setShowAll(true)}>
          후기 {list.length - FIRST_SHOWN}개 더 보기
        </Button>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="리뷰 삭제">
        <p className={styles.confirmText}>내 리뷰를 삭제할까요? 사진도 같이 지워지고 되돌릴 수 없어요.</p>
        <div className={styles.formBtns}>
          <Button variant="line" onClick={() => setConfirmDelete(false)}>
            취소
          </Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            삭제
          </Button>
        </div>
      </Modal>
      {reporting && <ReportDialog what="리뷰" onClose={() => setReporting(null)} onSubmit={(reason, detail) => report.mutate({ reviewId: reporting.id, reason, detail })} />}
      {viewer && <PhotoViewer photos={viewer.photos} start={viewer.start} onClose={() => setViewer(null)} />}
    </section>
  )
}
