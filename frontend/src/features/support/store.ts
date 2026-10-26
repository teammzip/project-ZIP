import { create } from 'zustand'
import { useAuthStore, type User } from '@/features/auth'
import { readJSON } from '@/lib/storage'

export const INQUIRY_CATEGORIES = ['이용 문의', '오류 신고', '개선 제안', '계정 문의', '기타'] as const
export type InquiryCategory = typeof INQUIRY_CATEGORIES[number]
export type Inquiry = {
  id: string
  userId: string
  nickname: string
  category: InquiryCategory
  title: string
  content: string
  createdAt: string
  answer: { content: string; createdAt: string } | null
}
type Draft = Pick<Inquiry, 'category' | 'title' | 'content'>
type SupportState = {
  inquiries: Inquiry[]
  add: (draft: Draft) => string
  reply: (id: string, content: string) => void
}

const KEY = 'zip-support'

/** 현재 브라우저용 시안. 운영 시 서버에서 작성자/관리자 권한을 확인하고 저장해야 함. */
export function visibleInquiries(inquiries: Inquiry[], user: User | null) {
  return user ? inquiries.filter((q) => user.role === 'ADMIN' || q.userId === user.id) : []
}

export const useSupportStore = create<SupportState>((set, get) => {
  // 저장 실패 시 성공 화면으로 넘어가거나 메모리에서만 접수되지 않도록 먼저 저장.
  const commit = (inquiries: Inquiry[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(inquiries))
    } catch {
      throw new Error('문의 내용을 저장하지 못했어요. 브라우저 저장 공간을 확인하고 다시 시도해 주세요.')
    }
    set({ inquiries })
  }
  return {
    inquiries: readJSON<Inquiry[]>(KEY) ?? [],
    add: (draft) => {
      const { user, token } = useAuthStore.getState()
      if (!user || !token) throw new Error('로그인 후 문의를 작성해 주세요.')
      const title = draft.title.trim()
      const content = draft.content.trim()
      if (!title || title.length > 100 || !content || content.length > 3000 || !INQUIRY_CATEGORIES.includes(draft.category)) {
        throw new Error('문의 유형, 제목(100자 이내), 내용(3,000자 이내)을 확인해 주세요.')
      }
      const id = crypto.randomUUID()
      commit([{ id, userId: user.id, nickname: user.nickname, category: draft.category, title, content, createdAt: new Date().toISOString(), answer: null }, ...get().inquiries])
      return id
    },
    reply: (id, value) => {
      const { user, token } = useAuthStore.getState()
      if (!token || user?.role !== 'ADMIN') throw new Error('관리자만 답변할 수 있어요.')
      const content = value.trim()
      if (!content || content.length > 3000) throw new Error('답변을 1~3,000자로 작성해 주세요.')
      const inquiry = get().inquiries.find((q) => q.id === id)
      if (!inquiry) throw new Error('문의를 찾을 수 없어요.')
      if (inquiry.answer) throw new Error('이미 답변이 등록된 문의예요.')
      commit(get().inquiries.map((q) => q.id === id ? { ...q, answer: { content, createdAt: new Date().toISOString() } } : q))
    },
  }
})
