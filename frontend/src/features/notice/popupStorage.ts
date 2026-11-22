import { useAuthStore } from '@/features/auth'

/* 공지 팝업의 '일주일 동안 보지 않기' 기록 (이 브라우저 · 회원별 localStorage).
 * '닫기'는 기록하지 않아요 — 지금 화면에서만 닫히고, 새로고침하거나 앱을 다시 열면 또 떠요. */

export const WEEK = 7 * 24 * 60 * 60 * 1000
/** v2: 테스트하며 남은 예전 기록은 무시 */
export const hideKey = (uid: string) => `zip-notice-popup-hide-v2:${uid}`
export const REOPEN = 'zip-notice-popup:open'

export function readHidden(uid: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(hideKey(uid)) ?? '{}') as Record<string, number> } catch { return {} }
}

/** 공지사항 화면의 '팝업 공지 다시 보기': 이 회원의 '일주일 동안 보지 않기' 기록을 지우고 팝업을 다시 띄워요 */
export function reopenNoticePopups() {
  const uid = useAuthStore.getState().user?.id
  try {
    if (uid) localStorage.removeItem(hideKey(uid))
  } catch { /* 저장소를 못 써도 이번 화면에서는 다시 뜸 */ }
  window.dispatchEvent(new Event(REOPEN))
}
