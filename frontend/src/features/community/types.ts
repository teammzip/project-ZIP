/* 커뮤니티 글 모양 (DB 구조 그림: db/erd-1-accounts-community.png) */
export type Comment = { author: string; text: string }

export type Post = {
  id: number
  /** 글이 속한 동네 예: '서울 마포구' */
  region: string
  cat: string
  title: string
  body: string
  author: string
  /** 내가 쓴 글이면 삭제 버튼이 보임 */
  mine: boolean
  /** 작성 시각 (ms) */
  ts: number
  likes: number
  liked: boolean
  comments: Comment[]
}
