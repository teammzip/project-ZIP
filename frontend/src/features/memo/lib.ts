import { MEMO_COLORS } from './constants'
import type { Memo } from './types'

export const colorOf = (name: string) => MEMO_COLORS.find((c) => c.name === name) ?? MEMO_COLORS[0]

/** 고정한 메모 먼저, 그다음 최근 수정 순 */
export const sortMemos = (list: Memo[]) => [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)

const lines = (m: Memo, mark: (done: boolean) => string) => (m.checklist ? m.items.map((it) => mark(it.done) + it.text) : m.body.split('\n'))

/** 제목이 없으면 첫 줄을 제목처럼 씀 */
export const titleOf = (m: Memo) => m.title.trim() || (lines(m, () => '')[0] ?? '').trim().slice(0, 30) || '새 메모'

/** 미리보기 줄 (제목 없이 쓴 메모는 첫 줄이 제목으로 쓰이니 뺌) */
export function previewLines(m: Memo, mark: (done: boolean) => string = () => '') {
  const all = lines(m, mark)
  return (m.title.trim() ? all : all.slice(1)).filter((l) => l.trim())
}

export const searchText = (m: Memo) => `${m.title}\n${lines(m, () => '').join('\n')}`.toLowerCase()

/** 방금 · N분 전 · 오늘이면 시:분 · 그 전이면 M월 D일 */
export function whenText(t: number, now = Date.now()) {
  const diff = now - t
  if (diff < 60000) return '방금'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  const d = new Date(t)
  if (new Date(now).toDateString() === d.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
