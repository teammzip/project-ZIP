import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { seedPosts } from './data/seed'
import type { Post } from './types'

/* 커뮤니티 글 목록. 서버가 없어서 이 브라우저(localStorage 'zip-posts')에만 저장됩니다.
 * 백엔드를 붙이면 features/community/api + useQuery 로 바꾸세요. */

type State = {
  posts: Post[]
  addPost: (p: Pick<Post, 'region' | 'cat' | 'title' | 'body' | 'author'>) => void
  removePost: (id: number) => void
  toggleLike: (id: number) => void
  addComment: (id: number, author: string, text: string) => void
  reset: () => void
}

const patch = (posts: Post[], id: number, fn: (p: Post) => Post) => posts.map((p) => (p.id === id ? fn(p) : p))

export const useCommunityStore = create<State>()(
  persist(
    (set) => ({
      posts: seedPosts(),
      addPost: (p) => set((s) => ({ posts: [{ ...p, id: Date.now(), mine: true, ts: Date.now(), likes: 0, liked: false, comments: [] }, ...s.posts] })),
      removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
      toggleLike: (id) => set((s) => ({ posts: patch(s.posts, id, (p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) })) })),
      addComment: (id, author, text) => set((s) => ({ posts: patch(s.posts, id, (p) => ({ ...p, comments: [...p.comments, { author, text }] })) })),
      reset: () => set({ posts: seedPosts() }),
    }),
    { name: 'zip-posts', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)
