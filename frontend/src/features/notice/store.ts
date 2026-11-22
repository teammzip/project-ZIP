import { create } from 'zustand'
import { useAuthStore } from '@/features/auth'
import { readJSON } from '@/lib/storage'

/* 공지사항 — 가짜 API 모드용 브라우저 저장(zip-notices). 서버 모드는 api.ts 가 /api/notices 를 써요 */

export type Notice = {
  id: string
  title: string
  /** 목록에는 없고 상세에만 있어요 (서버 모드) */
  body?: string
  pinned: boolean
  /** 앱을 열면 팝업으로 보여 줌 */
  popup: boolean
  author: string
  createdAt: string
  updatedAt: string
}

export type NoticeDraft = { title: string; body: string; pinned: boolean; popup: boolean }

export const TITLE_MAX = 100
export const BODY_MAX = 5000

const KEY = 'zip-notices'

/** 고정 먼저, 그다음 새 것부터 (서버와 같은 순서) */
export const sortNotices = (list: Notice[]) =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))

/** 제목 · 내용 검사. 문제가 있으면 화면에 보일 문구 */
export function draftError(draft: NoticeDraft) {
  const title = draft.title.trim()
  const body = draft.body.trim()
  if (!title) return '제목을 입력해 주세요.'
  if (title.length > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지 쓸 수 있어요.`
  if (!body) return '내용을 입력해 주세요.'
  if (body.length > BODY_MAX) return `내용은 ${BODY_MAX.toLocaleString()}자까지 쓸 수 있어요.`
  return ''
}

type NoticeState = {
  notices: Notice[]
  add: (draft: NoticeDraft) => string
  update: (id: string, draft: NoticeDraft) => void
  remove: (id: string) => void
}

export const useNoticeStore = create<NoticeState>((set, get) => {
  const commit = (notices: Notice[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(notices))
    } catch {
      throw new Error('공지를 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.')
    }
    set({ notices })
  }
  const admin = () => {
    const { user } = useAuthStore.getState()
    if (user?.role !== 'ADMIN') throw new Error('관리자만 공지를 관리할 수 있어요.')
    return user
  }
  const check = (draft: NoticeDraft) => {
    const error = draftError(draft)
    if (error) throw new Error(error)
    return { title: draft.title.trim(), body: draft.body.trim(), pinned: draft.pinned, popup: draft.popup }
  }
  return {
    notices: readJSON<Notice[]>(KEY) ?? [],
    add: (draft) => {
      const user = admin()
      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      commit([{ id, ...check(draft), author: user.nickname, createdAt: now, updatedAt: now }, ...get().notices])
      return id
    },
    update: (id, draft) => {
      admin()
      if (!get().notices.some((n) => n.id === id)) throw new Error('공지를 찾을 수 없어요.')
      const values = check(draft)
      commit(get().notices.map((n) => (n.id === id ? { ...n, ...values, updatedAt: new Date().toISOString() } : n)))
    },
    remove: (id) => {
      admin()
      commit(get().notices.filter((n) => n.id !== id))
    },
  }
})
