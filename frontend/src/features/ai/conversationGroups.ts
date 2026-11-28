/* AI 화면 왼쪽 대화 목록: GPT · Claude 처럼 날짜별로 묶음 (오늘 · 어제 · 지난 7일 · 지난 30일 · 이전) */

export type ConversationRow = { id: string; title: string | null; updatedAt: string }
export type ConversationGroup<T extends ConversationRow> = { label: string; items: T[] }

const LABELS = ['오늘', '어제', '지난 7일', '지난 30일', '이전'] as const

/** 기기 시간대 기준 날짜 차이로 묶음. 서버 순서(최근 순)를 그대로 지키고, 빈 묶음은 뺌 */
export function groupConversations<T extends ConversationRow>(rows: T[], now = new Date()): ConversationGroup<T>[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const buckets: T[][] = LABELS.map(() => [])
  for (const row of rows) {
    const at = new Date(row.updatedAt)
    const day = Number.isNaN(at.getTime()) ? Number.NEGATIVE_INFINITY : new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()
    const diff = Math.round((today - day) / 864e5)
    buckets[diff <= 0 ? 0 : diff === 1 ? 1 : diff <= 7 ? 2 : diff <= 30 ? 3 : 4].push(row)
  }
  return LABELS.map((label, i) => ({ label, items: buckets[i] })).filter((g) => g.items.length > 0)
}
