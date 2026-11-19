/* 커뮤니티 글 모양 (DB: db/schema.sql — posts · comments · post_likes · post_attachments) */
export type Comment = {
  /** 서버 댓글 번호 (서버 모드). 가짜 API 모드는 없어서 순서로 고쳐요 */
  id?: string
  /** 내가 신고한 댓글인지 (서버 모드) */
  reported?: boolean
  /** 답글이면 단 댓글(묶음의 맨 위 댓글) 번호. 한 단계만 */
  parentId?: string
  author: string
  text: string
  /** 쓴 회원의 id. 지금 로그인한 회원과 같으면 내 댓글 (수정·삭제 버튼이 보임) */
  ownerId?: string
  /** 운영자(관리자 화면)가 쓴 댓글: "운영자" 표시, 신고 버튼 없음 */
  staff?: boolean
}

/** 첨부 파일 (지금은 브라우저에 data URL 로 저장. 서버가 생기면 uploaded_files 의 주소로 바뀜) */
export type Attachment = {
  /** 서버에 올린 파일 번호 (서버 모드). 없으면 아직 안 올린 새 첨부 */
  id?: string
  name: string
  type: string
  size: number
  /** 가짜 API 모드: data URL, 서버 모드: 파일 주소(/api/files/content/…) */
  data: string
}

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
  views?: number
  likes: number
  liked: boolean
  comments: Comment[]
  /** 댓글 수 (서버 목록은 댓글 내용 없이 수만 줘요). 없으면 comments.length */
  commentCount?: number
  /** 내가 신고한 글인지 (서버 모드) */
  reported?: boolean
  /** 홈 "자취 꿀팁"에 보이는 글 (서버 모드, 관리자가 지정) */
  homeTip?: boolean
  attachments?: Attachment[]
}

/** 댓글 수: 서버 목록은 commentCount, 가짜 API 모드는 댓글 배열 길이 */
export const commentCountOf = (p: Post) => p.commentCount ?? p.comments.length

/** 글 쓰기 · 고치기에서 바꿀 수 있는 부분 */
export type PostDraft = Pick<Post, 'cat' | 'title' | 'body'> & { attachments: Attachment[] }

/** 내가 쓴 글인가? (로그인한 회원 id 와 글쓴이 id 가 같을 때만) */
export const isMine = (item: { ownerId?: string }, userId: string | null | undefined) => !!userId && item.ownerId === userId
