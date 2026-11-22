import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { reasonLabel, type Report } from '@/features/community'
import { reviewApi, reviewKeys, type AdminReviewReport } from '@/features/map'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import styles from './Admin.module.css'

type Filter = 'pending' | 'done' | 'all'

/** 같은 리뷰에 들어온 신고 묶음 */
type Group = { key: string; first: AdminReviewReport; reports: AdminReviewReport[]; pending: boolean; latest: number }

/** 장소 리뷰 신고 관리 (GET · PATCH /api/admin/place-review-reports). 리뷰별로 묶어 보고, 리뷰 삭제 · 문제없음 처리 */
export function AdminReviewReports() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('pending')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const reports = useQuery({ queryKey: reviewKeys.admin, queryFn: reviewApi.adminReports, staleTime: 10_000 })
  const resolve = useMutation({
    mutationFn: (v: { reportId: string; status: 'HIDDEN' | 'DISMISSED' }) => reviewApi.resolve(v.reportId, v.status),
    onSuccess: () => {
      setConfirmKey(null)
      // 신고 목록 + 지도 리뷰 · 별점 모두 새로
      void qc.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })

  const map = new Map<string, Group>()
  for (const r of reports.data ?? []) {
    const key = `${r.reviewKind}:${r.reviewId}`
    let g = map.get(key)
    if (!g) {
      g = { key, first: r, reports: [], pending: false, latest: 0 }
      map.set(key, g)
    }
    g.reports.push(r)
    g.pending ||= r.status === 'RECEIVED'
    g.latest = Math.max(g.latest, Date.parse(r.createdAt) || 0)
  }
  const groups = [...map.values()]
  const pendingCount = groups.filter((g) => g.pending).length
  const list = groups
    .filter((g) => (filter === 'pending' ? g.pending : filter === 'done' ? !g.pending : true))
    .sort((a, b) => Number(b.pending) - Number(a.pending) || b.reports.length - a.reports.length || b.latest - a.latest)

  return (
    <main className={styles.pane}>
      <div className={styles.tools}>
        <div className={styles.seg} role="tablist" aria-label="리뷰 신고 보기">
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
        <span className={styles.sub}>지도 장소 리뷰 신고예요. 같은 리뷰에 들어온 신고는 하나로 묶여요. 리뷰를 지우면 쓴 사람에게 알림이 가요.</span>
      </div>

      {reports.isLoading && <p className={styles.hint} role="status">리뷰 신고를 불러오고 있어요…</p>}
      {reports.isError && <p className={cx(styles.hint, styles.hot)} role="alert">리뷰 신고를 불러오지 못했어요. 새로고침해 주세요.</p>}
      {resolve.isError && <p className={cx(styles.hint, styles.hot)} role="alert">{getErrorMessage(resolve.error, '처리하지 못했어요. 잠시 후 다시 시도해 주세요.')}</p>}

      <div className={styles.reportList}>
        {list.map((g) => {
          const r = g.first
          const reasons = Object.entries(
            g.reports.reduce<Record<string, number>>((acc, x) => {
              acc[x.reason] = (acc[x.reason] ?? 0) + 1
              return acc
            }, {}),
          ).sort((a, b) => b[1] - a[1])
          const status = g.pending ? null : g.reports.some((x) => x.status === 'HIDDEN') ? '삭제함' : '문제없음'
          const open = openKey === g.key
          const pendingReport = g.reports.find((x) => x.status === 'RECEIVED') ?? r
          return (
            <article key={g.key} className={cx(styles.reportCard, !g.pending && styles.reportDone)}>
              <div className={styles.reportHead}>
                <span className={styles.badge}>리뷰</span>
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
                <b>{r.review.text ? <>&ldquo;{r.review.text}&rdquo;</> : '(내용 없이 별점만)'}</b>
                <p>
                  장소: {r.placeName}
                  {r.review.rating != null && ` · 별점 ${'★'.repeat(r.review.rating)}${'☆'.repeat(5 - r.review.rating)}`}
                  {r.reviewKind === 'KAKAO' && ' · 카카오 검색 장소'}
                </p>
                {r.review.deleted && g.pending && <p className={styles.hot}>이미 지워진 리뷰예요.</p>}
              </div>

              <div className={styles.reportMeta}>
                작성자 <b>{r.review.author || '(알 수 없음)'}</b>
                <button type="button" className={styles.linkBtn} onClick={() => setOpenKey(open ? null : g.key)} aria-expanded={open}>
                  신고 내용 {open ? '접기' : '보기'}
                </button>
              </div>

              {open && (
                <ul className={styles.reporters}>
                  {g.reports.map((x) => (
                    <li key={x.id}>
                      <b>{x.reporter.nickname}</b> · {reasonLabel(x.reason as Report['reason'])}
                      {x.detail && <span> — {x.detail}</span>}
                      <small> · {relTime(Date.parse(x.createdAt))}</small>
                    </li>
                  ))}
                </ul>
              )}

              {g.pending && (
                <div className={styles.reportActions}>
                  {r.review.deleted ? (
                    <Button variant="line" disabled={resolve.isPending} onClick={() => resolve.mutate({ reportId: pendingReport.id, status: 'DISMISSED' })}>
                      처리 완료로
                    </Button>
                  ) : confirmKey === g.key ? (
                    <>
                      <span className={styles.sub}>이 리뷰를 지울까요? 되돌릴 수 없어요.</span>
                      <Button variant="line" onClick={() => setConfirmKey(null)}>
                        취소
                      </Button>
                      <Button variant="danger" disabled={resolve.isPending} onClick={() => resolve.mutate({ reportId: pendingReport.id, status: 'HIDDEN' })}>
                        리뷰 삭제
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="line" disabled={resolve.isPending} onClick={() => resolve.mutate({ reportId: pendingReport.id, status: 'DISMISSED' })}>
                        문제없음
                      </Button>
                      <Button variant="danger" onClick={() => setConfirmKey(g.key)}>
                        리뷰 삭제
                      </Button>
                    </>
                  )}
                </div>
              )}
            </article>
          )
        })}
        {!reports.isLoading && !list.length && <p className={styles.empty}>{filter === 'pending' ? '처리할 리뷰 신고가 없어요 👍' : '리뷰 신고 내역이 없어요.'}</p>}
      </div>
    </main>
  )
}
