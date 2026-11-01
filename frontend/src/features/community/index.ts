/* 커뮤니티 기능의 바깥 창구. 다른 폴더에서는 '@/features/community' 에서만 가져다 쓰세요. */
export { CommunityBoard } from './components/CommunityBoard'
export { HomeTips } from './components/HomeTips'
export { useCommunityStore } from './store'
export { REPORT_REASONS, reasonLabel, useReportStore, type Report } from './reports'
export type { Post } from './types'
