import { commentCountOf, type Post } from './types'

export type PostSort = 'latest' | 'views' | 'popular' | 'relevance'

export const popularityOf = (post: Post) => post.likes + 2 * commentCountOf(post)

// 모의 모드에서 서버와 같은 생활 검색어를 제안한다.
const SEARCH_TERMS = new Set([
  '가스밸브', '계량기', '고지서', '공동현관', '공용현관', '곰팡이', '관리비', '관리실', '교재', '교체', '교환',
  '냉장고', '누수', '대형폐기물', '동물병원', '방충망', '배수', '배수구', '배출', '보일러', '분리배출', '분리수거',
  '세탁기', '세탁망', '세탁방', '수도계량기', '수리', '쓰레기', '약국', '에어컨', '우산', '월세', '이사', '입주',
  '재활용', '재활용품', '전기장판', '전기차', '전입신고', '종량제', '주차장', '주차차단기', '층간소음', '택배', '폐건전지', '현관등',
])
const HANGUL_START = '가'.charCodeAt(0)
const MEDIALS = 21
const FINALS = 28
const MAX_CANDIDATES = 4
const COMPACT_KOREAN_TERM = /^[가-힣]{3,}$/

function oneJamoDifference(word: string, term: string) {
  if (word.length !== term.length) return false
  let differences = 0
  for (let index = 0; index < word.length; index++) {
    const left = word.charCodeAt(index) - HANGUL_START
    const right = term.charCodeAt(index) - HANGUL_START
    if (left === right) continue
    if (Math.floor(left / (MEDIALS * FINALS)) !== Math.floor(right / (MEDIALS * FINALS))) differences++
    if (Math.floor(left / FINALS) % MEDIALS !== Math.floor(right / FINALS) % MEDIALS) differences++
    if (left % FINALS !== right % FINALS) differences++
    if (differences > 1) return false
  }
  return differences === 1
}

// 호출하는 화면이 같은 동네·카테고리의 결과가 없는 경우에만 사용한다.
export function suggestLocalPostQuery(posts: Post[], query: string) {
  if (query.length < 3) return undefined
  const candidates: string[] = []
  for (const match of query.matchAll(/(?<!\S)[가-힣]{2,}(?!\S)/gu)) {
    const word = match[0]
    if (SEARCH_TERMS.has(word)) continue
    for (const term of SEARCH_TERMS) {
      if (!oneJamoDifference(word, term)) continue
      if (candidates.length === MAX_CANDIDATES) return undefined
      candidates.push(query.slice(0, match.index) + term + query.slice(match.index + word.length))
    }
  }
  const supported = candidates.filter((candidate) => searchLocalPosts(posts, candidate, 'latest').length > 0)
  return supported.length === 1 ? supported[0] : undefined
}

export function searchLocalPosts(posts: Post[], query: string, sort: PostSort) {
  const phrase = query.trim().toLowerCase()
  const terms = [...new Set(phrase.split(/\s+/).filter(Boolean))]
  const compactTerms = new Set(terms.filter((term) => COMPACT_KOREAN_TERM.test(term)))
  const compactSingleQuery = COMPACT_KOREAN_TERM.test(phrase)
  return posts.flatMap((post) => {
    const title = post.title.toLowerCase()
    const body = post.body.toLowerCase()
    const compactTitle = compactTerms.size ? title.replaceAll(' ', '') : title
    const compactBody = compactTerms.size ? body.replaceAll(' ', '') : body
    if (!terms.every((word) => {
      if (compactTerms.has(word)) return compactTitle.includes(word) || compactBody.includes(word)
      return title.includes(word) || body.includes(word)
    })) return []

    let score = 0
    if (sort === 'views') score = post.views ?? 0
    if (sort === 'popular') score = popularityOf(post)
    if (sort === 'relevance' && terms.length) {
      const phraseMatch = terms.length > 1 && (title.includes(phrase) || body.includes(phrase))
      const rankedTitle = compactSingleQuery ? compactTitle : title
      const rankedBody = compactSingleQuery ? compactBody : body
      const bothFields = terms.every((word) => rankedTitle.includes(word) && rankedBody.includes(word))
      const titleMatch = compactSingleQuery && rankedTitle.includes(phrase)
      score = 4 * Number(phraseMatch) + 2 * Number(bothFields) + Number(titleMatch)
    }
    return [{ post, score }]
  }).sort((a, b) => b.score - a.score || b.post.ts - a.post.ts || b.post.id - a.post.id).map(({ post }) => post)
}
