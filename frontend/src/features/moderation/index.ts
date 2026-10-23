/* 이용 정지 · 경고 (운영 정책 제7조). 다른 폴더에서는 '@/features/moderation' 에서만 가져다 쓰세요. */
export { banLabel, banMessage, findActiveBan, fmtAt, isActive, useActiveBan } from './rules'
export { useBanStore, type BanRecord, type SanctionEntry } from './store'
