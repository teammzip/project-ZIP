import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { reviewApi, reviewKeys, type MyReview } from '../reviews'
import { PlaceReviews } from './PlaceReviews'

/** 장소 검색 리뷰와 같은 API를 사용하므로 여기서 수정·삭제해도 함께 반영됩니다. */
function useMyReviews() {
  const user = useAuthStore((s) => s.user)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  return useQuery({
    queryKey: [...reviewKeys.all, 'mine', user?.id, sessionKey],
    queryFn: () => reviewApi.mine(user ?? undefined),
    enabled: !!user,
  })
}

export function MyReviews({ className }: { className?: string }) {
  const query = useMyReviews()
  return <Link to="/my/settings/reviews" className={className}>
    <small>내가 쓴 리뷰</small>
    <b>{query.isError ? '조회 실패' : query.isPending ? '조회 중' : `${query.data?.length ?? 0}개`}</b>
  </Link>
}

export function MyReviewsList() {
  const query = useMyReviews()
  const [selected, setSelected] = useState<MyReview | null>(null)
  return <>
    <section aria-label="내가 쓴 리뷰 목록">
      {query.isPending ? <p role="status">리뷰를 불러오는 중이에요.</p>
        : query.isError ? <div role="alert"><p>{getErrorMessage(query.error, '리뷰를 불러오지 못했어요.')}</p><Button onClick={() => void query.refetch()}>다시 불러오기</Button></div>
          : !query.data?.length ? <p>아직 작성한 장소 리뷰가 없어요.</p>
            : <ul>{query.data.map((review) => <li key={`${review.placeId}:${review.id}`}>
              <Button variant="line" onClick={() => setSelected(review)}>{review.placeName} · ★ {review.rating} · {new Date(review.createdAt).toLocaleDateString('ko-KR')}</Button>
              {review.body && <p>{review.body}</p>}
            </li>)}</ul>}
    </section>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.placeName} 장소 리뷰` : '장소 리뷰'}>
      {selected && <><h3>{selected.placeName}</h3><PlaceReviews key={selected.placeId} placeId={selected.placeId} placeName={selected.placeName} initialShowAll /></>}
    </Modal>
  </>
}
