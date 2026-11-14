/* 커뮤니티 글 모양 (DB: db/schema.sql — posts · comments · post_likes · post_attachments) */
export type Comment = {
  author: string
  text: string
  /** 쓴 회원의 id. 지금 로그인한 회원과 같으면 내 댓글 (수정·삭제 버튼이 보임) */
  ownerId?: string
  /** 운영자(관리자 화면)가 쓴 댓글: "운영자" 표시, 신고 버튼 없음 */
  staff?: boolean
}

/** 첨부 파일 (지금은 브라우저에 data URL 로 저장. 서버가 생기면 uploaded_files 의 주소로 바뀜) */
export type Attachment = { name: string; type: string; size: number; data: string }

export type Post = {
  id: number
  /** 글이 속한 동네 예: '서울 마포구' */
  region: string
  cat: string
  title: string
  body: string
  author: string
  /** 쓴 회원의 id. 지금 로그인한 회원과 같으면 내가 쓴 글 (수정·삭제 버튼이 보임). 예시 글에는 없음 */
  ownerId?: string
  /** 작성 시각 (ms) */
  ts: number
  likes: number
  liked: boolean
  comments: Comment[]
  attachments?: Attachment[]
}

/** 글 쓰기 · 고치기에서 바꿀 수 있는 부분 */
export type PostDraft = Pick<Post, 'cat' | 'title' | 'body'> & { attachments: Attachment[] }

/** 내가 쓴 글인가? (로그인한 회원 id 와 글쓴이 id 가 같을 때만) */
export const isMine = (item: { ownerId?: string }, userId: string | null | undefined) => !!userId && item.ownerId === userId
