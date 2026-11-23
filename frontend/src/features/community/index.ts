/* 커뮤니티 기능의 바깥 창구. 다른 폴더에서는 '@/features/community' 에서만 가져다 쓰세요. */
export { CommunityBoard } from './components/CommunityBoard'
export { HomeCommunityPosts } from './components/HomeCommunityPosts'
export { ReportDialog } from './components/ReportDialog'
export { useCommunityStore } from './store'
export { useMyPostCount } from './useCommunity'
export { useAdminCommunity } from './useAdminCommunity'
export { REPORT_REASONS, isPending, reasonLabel, useReportStore, type Report, type ReportReason } from './reports'
export type { Post } from './types'
