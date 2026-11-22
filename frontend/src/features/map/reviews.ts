import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockApi } from '@/features/auth'
import { apiClient } from '@/lib/apiClient'

/* 장소 리뷰 (frontend/API.md 9장). 우리 ZIP 회원이 쓴 리뷰는 우리 서버에만 저장해요 (카카오로 보내지 않음).
 * 장소 id: DB 장소 "12" · 카카오 검색 장소 "kakao:123". 한 사람당 한 장소에 하나, 내 리뷰는 고치기 · 지우기, 남의 리뷰는 신고.
 * 사진은 리뷰당 5장까지: 새 사진은 먼저 POST /api/files 로 올리고(JPEG · PNG, 2MB) 그 id 를 photoIds 로 보내요.
 * 목업 모드(VITE_USE_MOCK)는 아래 mock 저장소(이 탭 메모리)로 똑같이 동작해요. */

export type ReviewPhoto = { id: string; url: string }
export type ReviewAuthor = {
  id: string
  nickname: string
  avatarUrl?: string | null
  avatarEmoji?: string | null
  avatarColor?: string | null
  /** 이 사람이 쓴 후기 수 · 별점 평균 (모든 장소) */
  reviewCount?: number
  ratingAvg?: number
}
export type PlaceReview = { id: string; rating: number; body: string; photos: ReviewPhoto[]; author: ReviewAuthor; createdAt: string; reportedByMe?: boolean }
/** 쓰기 · 고치기 창의 사진: 이미 올린 사진은 id, 새로 고른 사진은 file (url = 미리보기) */
export type PhotoDraft = { id?: string; url: string; file?: File }
export const PHOTO_MAX = 5
export const PHOTO_TYPES = ['image/jpeg', 'image/png']
export const PHOTO_BYTES = 2 * 1024 * 1024
export type ReviewSummary = { id: string; rating: number; count: number }
export type ReviewReportStatus = 'RECEIVED' | 'HIDDEN' | 'DISMISSED'
export type AdminReviewReport = {
  id: string
  reviewKind: 'PLACE' | 'KAKAO'
  reviewId: string
  placeId: string
  placeName: string
  review: { author: string; text: string; rating: number | null; deleted: boolean }
  reason: string
  detail: string
  reporter: { id: string; nickname: string }
  status: ReviewReportStatus
  createdAt: string
}

type Me = { id: string; nickname: string }

const path = (placeId: string) => `/places/${encodeURIComponent(placeId)}/reviews`
const isKakao = (placeId: string) => placeId.startsWith('kakao:')

// ---------- 목업 저장소 (목업 모드 전용, 새로고침하면 비워짐) ----------

const mock = {
  reviews: new Map<string, Array<PlaceReview & { placeName: string }>>(),
  reports: [] as Array<AdminReviewReport & { reporterKey: string }>,
  seq: 1,
}
const conflict = (message: string) => Object.assign(new Error(message), { status: 409 })
const mockPhotos = (photos: PhotoDraft[]): ReviewPhoto[] => photos.map((p) => ({ id: p.id ?? String(mock.seq++), url: p.url }))
const mockAuthor = (author: ReviewAuthor): ReviewAuthor => {
  const all = [...mock.reviews.values()].flat().filter((r) => r.author.id === author.id)
  return { ...author, reviewCount: all.length, ratingAvg: all.length ? Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10 : 0 }
}

const mockApi = {
  reviews: (placeId: string, me?: Me) =>
    (mock.reviews.get(placeId) ?? []).map(({ placeName: _placeName, ...r }) => ({ ...r, author: mockAuthor(r.author), reportedByMe: mock.reports.some((x) => x.reviewId === r.id && x.reporterKey === me?.id) })),
  add: (placeId: string, placeName: string, rating: number, body: string, photos: PhotoDraft[], me?: Me) => {
    const list = mock.reviews.get(placeId) ?? []
    if (list.some((r) => r.author.id === me?.id)) throw conflict('이미 이 장소에 리뷰를 썼어요. 내 리뷰를 고쳐 주세요.')
    const review = { id: String(mock.seq++), rating, body, photos: mockPhotos(photos), author: { id: me?.id ?? 'me', nickname: me?.nickname ?? '나' }, createdAt: new Date().toISOString(), placeName }
    mock.reviews.set(placeId, [review, ...list])
  },
  update: (placeId: string, rating: number, body: string, photos: PhotoDraft[], me?: Me) => {
    mock.reviews.set(placeId, (mock.reviews.get(placeId) ?? []).map((r) => (r.author.id === me?.id ? { ...r, rating, body, photos: mockPhotos(photos) } : r)))
  },
  remove: (placeId: string, me?: Me) => {
    mock.reviews.set(placeId, (mock.reviews.get(placeId) ?? []).filter((r) => r.author.id !== me?.id))
  },
  report: (placeId: string, reviewId: string, reason: string, detail: string, me?: Me) => {
    const review = mock.reviews.get(placeId)?.find((r) => r.id === reviewId)
    if (!review) throw new Error('리뷰를 찾을 수 없어요.')
    if (mock.reports.some((r) => r.reviewId === reviewId && r.reporterKey === me?.id)) throw conflict('이미 신고한 리뷰예요.')
    mock.reports.unshift({
      id: String(mock.seq++), reviewKind: isKakao(placeId) ? 'KAKAO' : 'PLACE', reviewId, placeId, placeName: review.placeName,
      review: { author: review.author.nickname, text: review.body, rating: review.rating, deleted: false },
      reason, detail, reporter: { id: me?.id ?? 'me', nickname: me?.nickname ?? '나' }, status: 'RECEIVED', createdAt: new Date().toISOString(), reporterKey: me?.id ?? 'me',
    })
  },
  summaries: (ids: string[]): ReviewSummary[] =>
    ids.flatMap((id) => {
      const list = mock.reviews.get(id) ?? []
      return list.length ? [{ id, rating: Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10, count: list.length }] : []
    }),
  adminReports: (): AdminReviewReport[] =>
    mock.reports.map(({ reporterKey: _reporterKey, ...r }) => ({ ...r, review: { ...r.review, deleted: !mock.reviews.get(r.placeId)?.some((x) => x.id === r.reviewId) } })),
  resolve: (reportId: string, status: 'HIDDEN' | 'DISMISSED') => {
    const target = mock.reports.find((r) => r.id === reportId)
    if (!target) return
    if (status === 'HIDDEN') mock.reviews.set(target.placeId, (mock.reviews.get(target.placeId) ?? []).filter((r) => r.id !== target.reviewId))
    for (const r of mock.reports) if (r.reviewId === target.reviewId && r.status === 'RECEIVED') r.status = status
  },
}

// ---------- 서버 · 목업 공통 API ----------

/** 목업 모드: 새 사진은 data URL 로 (미리보기 주소는 창을 닫으면 사라져서) */
const asDataUrls = (photos: PhotoDraft[]) =>
  Promise.all(
    photos.map((p) =>
      p.file
        ? new Promise<PhotoDraft>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ url: String(reader.result) })
            reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'))
            reader.readAsDataURL(p.file as File)
          })
        : Promise.resolve(p),
    ),
  )

/** 새로 고른 사진은 서버에 올리고(동시에, 순서는 그대로) 이미 올린 사진은 id 그대로 */
const uploadPhotos = (photos: PhotoDraft[]) =>
  Promise.all(
    photos.map(async (p) => {
      if (p.id) return p.id
      if (!p.file) throw new Error('사진을 다시 골라 주세요.')
      const form = new FormData()
      form.append('file', p.file)
      return (await apiClient.post<{ id: string }>('/files', form)).data.id
    }),
  )

export const reviewApi = {
  reviews: async (placeId: string, me?: Me) => (isMockApi ? mockApi.reviews(placeId, me) : (await apiClient.get<PlaceReview[]>(path(placeId))).data),
  /** 카카오 장소는 장소 이름(60자)도 같이 (서버는 카카오 장소 id · 이름 + 리뷰만 저장) */
  add: async (placeId: string, placeName: string, rating: number, body: string, photos: PhotoDraft[], me?: Me) => {
    if (isMockApi) return mockApi.add(placeId, placeName, rating, body, await asDataUrls(photos), me)
    const photoIds = await uploadPhotos(photos)
    await apiClient.post(path(placeId), { rating, body, photoIds, ...(isKakao(placeId) ? { name: placeName.slice(0, 60) } : {}) })
  },
  update: async (placeId: string, rating: number, body: string, photos: PhotoDraft[], me?: Me) => {
    if (isMockApi) return mockApi.update(placeId, rating, body, await asDataUrls(photos), me)
    const photoIds = await uploadPhotos(photos)
    await apiClient.put(`${path(placeId)}/mine`, { rating, body, photoIds })
  },
  remove: async (placeId: string, me?: Me) => {
    if (isMockApi) return mockApi.remove(placeId, me)
    await apiClient.delete(`${path(placeId)}/mine`)
  },
  report: async (placeId: string, reviewId: string, reason: string, detail: string, me?: Me) => {
    if (isMockApi) return mockApi.report(placeId, reviewId, reason, detail, me)
    await apiClient.post(`${path(placeId)}/${encodeURIComponent(reviewId)}/reports`, { reason, detail })
  },
  summaries: async (ids: string[]) =>
    isMockApi ? mockApi.summaries(ids) : (await apiClient.get<ReviewSummary[]>('/places/review-summary', { params: { ids: ids.join(',') } })).data,
  adminReports: async () => (isMockApi ? mockApi.adminReports() : (await apiClient.get<AdminReviewReport[]>('/admin/place-review-reports')).data),
  resolve: async (reportId: string, status: 'HIDDEN' | 'DISMISSED') => {
    if (isMockApi) return mockApi.resolve(reportId, status)
    await apiClient.patch(`/admin/place-review-reports/${encodeURIComponent(reportId)}`, { status })
  },
}

export const reviewKeys = {
  all: ['map', 'reviews'] as const,
  place: (placeId: string) => ['map', 'reviews', 'place', placeId] as const,
  summary: (ids: string[]) => ['map', 'reviews', 'summary', ids.join(',')] as const,
  admin: ['map', 'reviews', 'admin'] as const,
}

/** 리뷰가 바뀌면 (쓰기 · 고치기 · 지우기 · 신고 처리) 장소 리뷰 · 목록 별점을 모두 새로 */
export function useInvalidateReviews() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: reviewKeys.all })
}

const SUMMARY_MAX = 100

/** 지도 목록의 별점 (장소 id → 평균 · 수). 리뷰 없는 곳은 없음 */
export function useReviewSummaries(ids: string[]) {
  const unique = [...new Set(ids)].sort().slice(0, SUMMARY_MAX)
  const query = useQuery({
    queryKey: reviewKeys.summary(unique),
    queryFn: () => reviewApi.summaries(unique),
    enabled: unique.length > 0,
    staleTime: 60_000,
  })
  return new Map((query.data ?? []).map((s) => [s.id, s]))
}
