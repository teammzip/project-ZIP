import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { seedPosts } from './data/seed'
import type { Post, PostDraft } from './types'

/* 커뮤니티 글 목록. 서버가 없어서 이 브라우저(localStorage 'zip-posts')에만 저장됩니다.
 * 백엔드를 붙이면 features/community/api + useQuery 로 바꾸세요.
 * 첨부 파일까지 브라우저에 넣다 보니 저장 공간(보통 5MB)이 찰 수 있어요. 저장에 실패하면 바꾸기 전으로 되돌리고 false 를 돌려줘요. */

let writeFailed = false
/** 저장 공간이 꽉 차서 쓰기에 실패하면 기억해 두는 localStorage */
const safeStorage: StateStorage = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      writeFailed = true
    }
  },
  removeItem: (k) => localStorage.removeItem(k),
}

type State = {
  posts: Post[]
  /** 저장에 실패하면 false (저장 공간 부족) */
  addPost: (p: PostDraft & Pick<Post, 'region' | 'author'>) => boolean
  updatePost: (id: number, draft: PostDraft) => boolean
  removePost: (id: number) => void
  toggleLike: (id: number) => void
  addComment: (id: number, author: string, text: string) => void
  updateComment: (id: number, index: number, text: string) => void
  removeComment: (id: number, index: number) => void
  reset: () => void
}

const patch = (posts: Post[], id: number, fn: (p: Post) => Post) => posts.map((p) => (p.id === id ? fn(p) : p))

export const useCommunityStore = create<State>()(
  persist(
    (set, get) => {
      /** 바꾸고 저장해 보고, 실패하면 되돌림 */
      const tryChange = (next: Post[]) => {
        const prev = get().posts
        writeFailed = false
        set({ posts: next })
        if (!writeFailed) return true
        writeFailed = false
        set({ posts: prev })
        return false
      }
      return {
        posts: seedPosts(),
        addPost: (p) => tryChange([{ ...p, id: Date.now(), mine: true, ts: Date.now(), likes: 0, liked: false, comments: [] }, ...get().posts]),
        updatePost: (id, draft) => tryChange(patch(get().posts, id, (p) => ({ ...p, ...draft }))),
        removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
        toggleLike: (id) => set((s) => ({ posts: patch(s.posts, id, (p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) })) })),
        addComment: (id, author, text) => set((s) => ({ posts: patch(s.posts, id, (p) => ({ ...p, comments: [...p.comments, { author, text, mine: true }] })) })),
        updateComment: (id, index, text) =>
          set((s) => ({ posts: patch(s.posts, id, (p) => ({ ...p, comments: p.comments.map((c, i) => (i === index ? { ...c, text } : c)) })) })),
        removeComment: (id, index) => set((s) => ({ posts: patch(s.posts, id, (p) => ({ ...p, comments: p.comments.filter((_, i) => i !== index) })) })),
        reset: () => set({ posts: seedPosts() }),
      }
    },
    { name: 'zip-posts', storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
)
