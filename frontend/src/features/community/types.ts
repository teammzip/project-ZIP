/* 커뮤니티 글 모양 (DB 구조: db/erd-4-community.png — posts · comments · post_likes · post_attachments) */
export type Comment = {
  author: string
  text: string
  /** 내가 쓴 댓글이면 수정·삭제 버튼이 보임 */
  mine?: boolean
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
  /** 내가 쓴 글이면 수정·삭제 버튼이 보임 */
  mine: boolean
  /** 작성 시각 (ms) */
  ts: number
  likes: number
  liked: boolean
  comments: Comment[]
  attachments?: Attachment[]
}

/** 글 쓰기 · 고치기에서 바꿀 수 있는 부분 */
export type PostDraft = Pick<Post, 'cat' | 'title' | 'body'> & { attachments: Attachment[] }
