/* AI 대화 주제, 앱에서 제공하는 답변 */

export type AiContext = {
  /** 우리 동네 (없으면 '자취방') */
  region: string
  name: string
  hasPhoto: boolean
}

export type TopicAction = { kind: 'copy'; label: string } | { kind: 'link'; label: string; to: string }

export type Topic = {
  id: string
  ico: string
  name: string
  desc: string
  /** 사진과 같이 물어보기 좋은 분야 (사진이 있으면 '추천' 표시) */
  photo: boolean
  input?: { label: string; placeholder: string }
  reply?: (keyword: string, ctx: AiContext) => string
  /** 답변 아래에 표시할 버튼 */
  action?: (keyword: string) => TopicAction | null
}

const R_TRASH = '분리배출 기본 원칙이에요.\n\n• 플라스틱·캔·유리병: 내용물 비우고 헹군 뒤 라벨 제거\n• 종이: 테이프·스테이플러 제거 후 펼쳐서 묶기\n• 음식물: 종량제(음식물) 봉투나 전용 용기 사용\n• 배달 용기: 기름기가 남으면 일반쓰레기\n\n배출 요일과 시간은 지역마다 달라서, 사는 동네 구청 안내를 꼭 확인하세요.'
const R_COOK = '임박 재료를 기준으로 추천해요.\n\n1) 두부 샐러드: 두부 + 방울토마토 + 올리브유, 5분\n2) 계란 볶음밥: 남은 밥 + 계란 + 대파, 15분\n3) 우유 계란찜: 우유를 섞으면 더 부드러워요\n\n임박 재료부터 먼저 쓰는 걸 추천해요.'
const R_MOLD = '곰팡이 대처 순서예요.\n\n1) 창문을 열어 환기하고 가구를 벽에서 5cm 이상 띄워요\n2) 곰팡이 제거제를 뿌리고 10분 뒤 닦아요\n3) 완전히 말린 뒤 제습제를 두세요\n\n⚠️ 락스와 산성 세제를 절대 섞지 마세요. 유해가스가 나와요. 벽 안쪽 누수가 원인이면 집주인에게 수리를 요청해야 해요.'
const R_CONTRACT = '계약과 보증금 기본 체크리스트예요.\n\n• 입주 당일 전입신고 + 확정일자 받기\n• 계약 전 등기부등본으로 근저당·소유자 확인\n• 입주 때 집 상태를 사진·영상으로 기록해 두기\n• 퇴거 전 집주인에게 미리 통보하고 보증금 반환 일정 확인\n\n법률 자문이 아니라 일반 정보예요. 큰 금액이 걸리면 전문가나 공공기관 상담을 받으세요.'
const R_BILL = '공과금은 납부일을 캘린더에 등록해 두면 편해요. 자동이체를 걸어 두면 연체를 막을 수 있고, 겨울철 가스비는 외출 모드와 단열 뽁뽁이로 줄일 수 있어요.'
export const R_UNKNOWN = '아직 데모 버전이라 몇 가지 주제만 답할 수 있어요.\n\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금, 집주인 문자, 근처 탐색 분야를 골라보세요.'

export function keywordReply(q: string) {
  const s = q.replace(/\s/g, '')
  if (/분리|배출|쓰레기|재활용/.test(s)) return R_TRASH
  if (/요리|냉장고|레시피|뭐해먹|먹을/.test(s)) return R_COOK
  if (/곰팡이|습기|제습/.test(s)) return R_MOLD
  if (/보증금|계약|전입|확정일자|월세/.test(s)) return R_CONTRACT
  if (/공과금|전기|가스|수도|관리비/.test(s)) return R_BILL
  return R_UNKNOWN
}

export const TOPICS: Topic[] = [
  {
    id: 'qna', ico: '💬', name: '자유 질문', desc: '자취 관련 궁금한 것', photo: false,
    input: { label: '궁금한 점', placeholder: '예) 세탁기에서 냄새가 나요' },
    reply: keywordReply,
  },
  {
    id: 'guide', ico: '🧭', name: '사용 방법', desc: '기능별 사용 방법 보기', photo: false,
  },
  {
    id: 'nearby', ico: '📍', name: '근처 탐색', desc: '세탁방·편의점·약국·카페·병원 등', photo: false,
    input: { label: '찾는 곳', placeholder: '예) 약국, 세탁방, 가게 이름' },
  },
  {
    id: 'trash', ico: '♻️', name: '분리배출', desc: '이건 어떻게 버려요?', photo: true,
    input: { label: '버릴 물건', placeholder: '예) 치킨 뼈, 깨진 컵, 택배 박스' },
    reply: () => R_TRASH,
  },
  {
    id: 'cook', ico: '🍳', name: '냉장고 요리', desc: '남은 재료로 한 끼', photo: true,
    input: { label: '가진 재료와 조건', placeholder: '예) 두부, 달걀, 15분' },
    reply: () => R_COOK,
  },
  {
    id: 'clean', ico: '🧹', name: '청소·곰팡이', desc: '얼룩, 냄새, 곰팡이', photo: true,
    input: { label: '어디가 어떤가요?', placeholder: '예) 욕실 천장에 검은 곰팡이' },
    reply: () => R_MOLD,
  },
  {
    id: 'contract', ico: '📄', name: '계약·보증금', desc: '입주·퇴거 체크리스트', photo: false,
    input: { label: '지금 상황', placeholder: '예) 다음 달 퇴거인데 보증금 반환이 걱정돼요' },
    reply: () => R_CONTRACT,
  },
  {
    id: 'landlord', ico: '📝', name: '집주인 문자', desc: '정중한 요청 문자 초안', photo: true,
    input: { label: '문제 상황', placeholder: '예) 보일러가 작동하지 않아요' },
    reply: (keyword, ctx) => {
      const issue = keyword || '확인이 필요한 사항이 있습니다'
      return `집주인에게 보낼 문자 초안이에요.\n\n안녕하세요, 사장님. 세입자 ${ctx.name}입니다.\n다름이 아니라 아래 문제로 연락드립니다.\n- ${issue}\n${ctx.hasPhoto ? '사진을 함께 보내드리니 확인 부탁드립니다.' : '상황을 말씀드리니 확인 부탁드립니다.'}\n가능하신 방문 일정이나 조치 방법을 알려주시면 맞춰서 협조하겠습니다.\n바쁘신 중에 죄송하고, 회신 기다리겠습니다. 감사합니다.\n\n※ 상황에 맞게 내용을 고쳐서 보내세요.`
    },
    action: () => ({ kind: 'copy', label: '문자 복사' }),
  },
  {
    id: 'bill', ico: '💡', name: '공과금·생활비', desc: '아끼는 법, 납부 관리', photo: false,
    input: { label: '궁금한 점', placeholder: '예) 겨울 가스비를 줄이고 싶어요' },
    reply: () => R_BILL,
  },
  {
    id: 'summary', ico: '📊', name: '수입·지출 요약', desc: '이번 달 수입 대비 지출', photo: false,
  },
]

export const topicById = (id: string | null | undefined) => TOPICS.find((t) => t.id === id) ?? null

export function chatMessageText(topic: Topic | null, input: string) {
  if (topic?.id === 'guide') return ''
  return input.trim() || (topic?.id === 'summary' ? topic.name : '')
}

export function usesAiReply(topic: Topic | null) {
  return !topic || !['guide', 'nearby', 'landlord', 'summary'].includes(topic.id)
}

export const PHOTO_NOTE = '\n\n📷 지금은 데모 버전이라 사진 내용을 직접 분석하지는 못해요. 실제 AI를 연결하면 사진을 함께 보내 더 정확히 답해드려요.'

/* ---------- 홈 "AI와 대화" 모달용 ---------- */

/** 홈의 빠른 주제 */
export const CHAT_TOPICS = [
  { id: 'trash', label: '♻️ 분리배출' },
  { id: 'cook', label: '🍳 냉장고 요리' },
  { id: 'clean', label: '🧹 청소·곰팡이' },
  { id: 'contract', label: '📄 계약·보증금' },
  { id: 'bill', label: '💡 공과금·생활비' },
  { id: 'summary', label: '📊 수입·지출 요약' },
]

/** 직접 입력한 질문도 지출 요약으로 연결 */
export const SUMMARY_ASK = /수입\s*대비\s*지출|지출.*(요약|정리|얼마)|얼마.*(썼|지출)|이번\s*달.*(소비|지출)/
export const BUDGET_LOAD_ERROR = '가계부 기록을 불러오지 못했어요. 잠시 뒤 다시 요청해 주세요.'

export type TopicSuggestion = { topicId: string; keyword: string }

const topicKeywords: Array<[string, RegExp]> = [
  ['trash', /분리배출|분리수거|재활용|쓰레기|버리는법|어떻게버려|버려도|치킨뼈|깨진컵|폐건전지|택배박스/],
  ['cook', /레시피|요리|뭐해먹|두부|달걀|계란|김치찌개|볶음밥|방울토마토|프라이팬|육수/],
  ['clean', /청소|곰팡이|얼룩|물때|제습|악취|세탁기.*냄새/],
  ['nearby', /세탁방|빨래방|편의점|약국|카페(?!인)|병원|맛집|주차장/],
  ['contract', /보증금|임대차|전입신고|확정일자|계약서|계약갱신|퇴거|(?:월세|전세)계약/],
  ['landlord', /집주인|임대인.*(문자|연락)|보일러.*(고장|작동하지|안켜)|누수.*수리/],
  ['bill', /공과금|생활비|전기(요금|세)|가스(요금|비)|수도(요금|세)|관리비|요금납부|고지서/],
  ['guide', /앱(사용|설정)|어디서.*(등록|기록)|(등록|기록).*어디서|기능.*어디|메뉴.*어디/],
]

export function getTopicSuggestion(selected: Topic | null, keyword: string) {
  if (!selected?.input || selected.id === 'qna' || !keyword.trim()) return null

  const compact = keyword.replace(/\s/g, '')
  const matches = topicKeywords.filter(([, pattern]) => pattern.test(compact)).map(([id]) => id)
  if (SUMMARY_ASK.test(keyword)) matches.push('summary')
  const suggestedId = matches.length === 1 ? matches[0] : null
  const suggested = suggestedId !== selected.id ? topicById(suggestedId) : null
  if (!suggested) return null

  return {
    text: `입력한 키워드는 ‘${selected.name}’ 주제와 잘 맞지 않아요. ` + (suggested.id === 'guide'
      ? '아래 ‘사용 방법’ 칩을 눌러 찾는 기능을 선택해 보세요.'
      : `아래 ‘${suggested.name}’ 칩을 선택해서 다시 물어보세요.`),
    suggestion: { topicId: suggested.id, keyword },
  }
}

export function chatReply(text: string, topic: Topic | null, ctx: AiContext) {
  const out = topic?.reply?.(text, ctx) ?? keywordReply(text)
  return out === R_UNKNOWN
    ? '아직 데모 버전이라 몇 가지 주제만 답할 수 있어요.\n\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금, 이번 달 지출에 대해 물어보세요. 아래 버튼을 눌러도 돼요.'
    : out
}
