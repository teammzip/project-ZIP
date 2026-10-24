import { ALL_PLACES, PLACE_KINDS, walkMin, type PlaceItem } from './data/places'

/* AI 장소 찾기 (시연용 — 팀장님 시안 views/map.js 와 같은 규칙): 예시 데이터 안에서 말을 읽어 장소를 고름.
 * 실제 서비스에서는 AI 와 지도 검색 API 가 근처 장소를 찾아 줌 */

/** 말 → 찾을 장소 종류 */
const SYN: Array<[RegExp, string[]]> = [
  [/빨래|세탁|이불|건조/, ['세탁방', '세탁소']],
  [/편의점|야식|간식|담배|새벽/, ['편의점']],
  [/약|감기|두통|소화|밴드/, ['약국']],
  [/아파|아프|병원|진료|치과|내과|열|소아/, ['병원', '약국']],
  [/장보|식재료|마트|채소|과일/, ['마트', '반찬가게']],
  [/커피|카페|공부|스터디|작업|노트북/, ['카페']],
  [/운동|헬스|요가|조깅|PT/i, ['헬스장', '공원']],
  [/돈|출금|입금|은행|atm/i, ['은행']],
  [/머리|커트|미용|파마/, ['미용실']],
  [/생활용품|다이소|수납|청소용품|잡화/, ['다이소', '마트']],
  [/밥|식당|혼밥|먹|배고|점심|저녁|국밥|분식/, ['식당', '반찬가게']],
  [/반찬/, ['반찬가게']],
  [/전입|주민|서류|등본|민원/, ['주민센터']],
  [/공원|산책|걷|벤치/, ['공원']],
  [/수선|드라이|옷/, ['세탁소']],
]

/** 말 → 원하는 조건 (조건 글자가 장소 설명에 있으면 점수를 더함) */
const MODS = [
  { re: /24|밤|심야|새벽|야간|늦게/, has: /24시간|심야|야간/, label: '24시간·심야 운영', w: 3 },
  { re: /싼|저렴|가성비|값/, has: /저렴|월 3만원/, label: '저렴함', w: 2 },
  { re: /조용|한적|스터디|콘센트/, has: /조용|스터디|콘센트/, label: '조용함', w: 2 },
  { re: /혼밥|혼자/, has: /혼밥/, label: '혼밥하기 좋음', w: 2 },
  { re: /주말|토요일/, has: /토요일|주말/, label: '주말 이용', w: 2 },
]

export type FoundPlace = { p: PlaceItem; score: number; why: string[] }

/** 말에 맞는 장소를 점수 순으로 최대 5곳 (가까울수록 조금 더 위) */
export function aiFind(q: string): FoundPlace[] {
  const s = q.replace(/\s/g, '')
  const wantCats: string[] = []
  for (const [re, cats] of SYN) if (re.test(s)) for (const c of cats) if (!wantCats.includes(c)) wantCats.push(c)
  for (const c of PLACE_KINDS) if (s.includes(c) && !wantCats.includes(c)) wantCats.push(c) // 종류 이름을 그대로 쓴 경우
  const mods = MODS.filter((m) => m.re.test(s))
  const tokens = q
    .split(/[\s,]+/)
    .map((t) => t.replace(/(이나|에서|근처|주변|가까운|제일|있는|찾아줘|알려줘|어디|있어|싶어|해줘|좀)$/, ''))
    .filter((t) => t.length >= 2)

  const res: FoundPlace[] = []
  for (const p of ALL_PLACES) {
    let score = 0
    const why: string[] = []
    if (wantCats.includes(p.cat)) {
      score += 5
      why.push(p.cat)
    }
    for (const t of tokens)
      if ((p.n + p.d).includes(t)) {
        score += 3
        if (!why.includes(`"${t}" 포함`)) why.push(`"${t}" 포함`)
      }
    for (const m of mods)
      if (m.has.test(p.d)) {
        score += m.w
        why.push(m.label)
      }
    if (score >= 3) res.push({ p, score: score + (20 - Math.min(walkMin(p), 20)) / 20, why })
  }
  return res.sort((a, b) => b.score - a.score).slice(0, 5)
}
