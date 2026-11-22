/* 메모 모양 (서버 모드는 DB memos 표 — frontend/API.md 12번, features/memo/sync.ts) */
export type MemoItem = { text: string; done: boolean }
export type MemoFolder = { id: string; name: string }

export type Memo = {
  id: number
  title: string
  ledgerContext?: string | null
  draft?: boolean
  folderId?: string | null
  /** 글 메모 내용 (checklist 가 false 일 때) */
  body: string
  /** MEMO_COLORS 의 이름 */
  color: string
  /** 맨 위에 고정 */
  pinned: boolean
  /** true 면 items(줄마다 체크)를 씀 */
  checklist: boolean
  items: MemoItem[]
  createdAt: number
  updatedAt: number
}
