import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/* 커뮤니티 신고 (localStorage 'zip-reports'). 서버가 생기면 POST /api/reports 로 보내고 관리자는 GET /api/admin/reports 로 봐요 (frontend/API.md)
 * 같은 사람이 같은 글 · 댓글을 두 번 신고할 수 없어요. 댓글에 아직 번호(id)가 없어서 글 번호 + 댓글 순서로 가리키고, 관리자 화면용으로 신고 당시 내용을 같이 남겨요 */

/** 신고 사유 (API · DB 의 reason 값과 같음) */
export const REPORT_REASONS = [
  { code: 'ABUSE', label: '욕설 · 비방 · 혐오 표현' },
  { code: 'FALSE_INFO', label: '거짓 정보' },
  { code: 'PRIVACY', label: '개인정보 노출' },
  { code: 'AD_ILLEGAL', label: '광고 · 불법 거래' },
  { code: 'COPYRIGHT', label: '저작권 침해' },
  { code: 'OTHER', label: '기타' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['code']

export type Report = {
  id: string
  targetType: 'POST' | 'COMMENT'
  postId: number
  /** 댓글이면 그 글에서 몇 번째 댓글인지 */
  commentIndex?: number
  targetAuthor: string
  /** 신고 당시 글 제목 또는 댓글 내용 */
  targetText: string
  reason: ReportReason
  detail: string
  reporter: string
  at: number
}

export const reasonLabel = (code: ReportReason) => REPORT_REASONS.find((r) => r.code === code)?.label ?? code

const sameTarget = (r: Pick<Report, 'targetType' | 'postId' | 'commentIndex'>, t: Pick<Report, 'targetType' | 'postId' | 'commentIndex'>) =>
  r.targetType === t.targetType && r.postId === t.postId && (r.commentIndex ?? -1) === (t.commentIndex ?? -1)

type State = {
  reports: Report[]
  /** 신고 접수. 이미 같은 대상을 신고했으면 false */
  add: (r: Omit<Report, 'id' | 'at'>) => boolean
  reset: () => void
}

export const useReportStore = create<State>()(
  persist(
    (set, get) => ({
      reports: [],
      add: (r) => {
        if (get().reports.some((x) => x.reporter === r.reporter && sameTarget(x, r))) return false
        set((s) => ({ reports: [...s.reports, { ...r, id: crypto.randomUUID(), at: Date.now() }] }))
        return true
      },
      reset: () => set({ reports: [] }),
    }),
    { name: 'zip-reports', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)

/** 내가 이 대상을 이미 신고했는지 */
export const useReported = (reporter: string, target: Pick<Report, 'targetType' | 'postId' | 'commentIndex'>) =>
  useReportStore((s) => s.reports.some((r) => r.reporter === reporter && sameTarget(r, target)))
