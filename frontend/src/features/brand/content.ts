/* 시작 화면(브랜드 스토리) 문구와 그림 데이터. 문구를 바꿀 때는 이 파일만 고치면 됩니다.
 * 디자인은 호호컴퍼니(https://hohocompany.com) 처럼: 연한 하늘색 바탕 + 3D 로봇과 흰 말풍선,
 * 진한 남색 굵은 제목(마지막 줄은 파란색), 큰 흰 판 위의 번호 목록 · 카드, 어두운 맨 아래.
 * 그림은 3D 로봇(robot-cut) · 3D 집(house-mobile) · 앱 화면 그림(Phone)으로 채웠어요. */
import type { ScreenName } from './components/Phone'

/* ---------- 1. 첫 화면 ---------- */
export const HERO = {
  kicker: '자취생 생활 도우미 ZIP',
  lines: ['어서와요,', '새로운 ZIP이에요.'],
  description: '월세 날짜부터 분리배출 요일까지.\n흩어져 있던 자취 생활을 한곳에서 챙겨요.',
  greeting: '안녕하세요, ZIP이에요!',
  scrollCue: '질문 하나를 따라가 보세요',
}

/** 로봇 옆에 떠 있는 흰 카드 (앱 홈 화면의 요약 카드) */
export type HeroWidget = { icon: string; label: string; value: string; tone: string }
export const HERO_WIDGETS: HeroWidget[] = [
  { icon: '💸', label: '월세 납부일', value: 'D-3', tone: '#efeaff' },
  { icon: '✅', label: '오늘 할 일', value: '3개 남음', tone: '#e7f0fe' },
  { icon: '♻️', label: '오늘 배출', value: '재활용', tone: '#e3f6f2' },
]

/* ---------- 2. 카드 구름이 돌며 → 로고 (PC 만, 첫 화면 바로 다음) ---------- */
export const CLOUD = {
  caption: '흩어져 있던 자취 생활을',
  after: '한곳에 모았어요',
}
/** 구름을 이루는 작은 카드 그림 (돌려 가며 씀) */
export const CLOUD_ICONS = ['🛏️', '🪴', '🍳', '🧺', '💡', '📦', '🧹', '🛋️', '☕', '🎧', '🖼️', '🧴', '🍜', '🚲', '📚', '🕯️', '🧸', '🪞', '🍓', '🧊']
export const CLOUD_COLORS = ['#ffe3d3', '#dff5e3', '#fff4cc', '#e3eeff', '#ffe7ea', '#f1efff', '#e9f7f2', '#fff1e6']

/* ---------- 3. 어두운 화면: 문장이 바뀌다가 화면 가득 ---------- */
export const CINEMA = {
  lines: ['월세 날짜는 메모장에,\n분리배출 요일은 현관 앞 종이에', '흩어진 자취 생활을\n한곳에서 챙겨 주는 집'],
  final: '혼자 사는 모두,\nZIP에 산다',
}

/* ---------- 4. 한 줄씩 진해지는 문장 + 오른쪽 카드 ---------- */
export type FocusItem = { line: string; caption: string; screen: ScreenName; tint: string }
export const FOCUS_ITEMS: FocusItem[] = [
  { line: '오늘 할 일과 일정은 한눈에,', caption: '할 일과 일정을\n한 화면에서', screen: 'calendar', tint: '#eaf2fe' },
  { line: '월세 · 공과금은 잊기 전에,', caption: '새는 돈 없는\n자취 가계부', screen: 'budget', tint: '#eef0fd' },
  { line: '헷갈리는 분리배출은 사진 한 장으로,', caption: '사진 한 장이면\n척척 알려 주는 AI', screen: 'ai', tint: '#e9f6f8' },
  { line: '이웃과 나누는 동네 이야기까지', caption: '우리 동네 꿀팁을\n이웃과 함께', screen: 'community', tint: '#eef3fb' },
  { line: '자취가 훨씬 쉬워집니다', caption: '혼자여도\n든든한 하루', screen: 'home', tint: '#e7f0fe' },
]

/* ---------- 5. 휴대폰 두 대 + 큰 제목 (번갈아) ---------- */
export type ShowcaseRow = { title: string; body: string; screens: [ScreenName, ScreenName] }
export const SHOWCASE_ROWS: ShowcaseRow[] = [
  {
    title: '할 일도, 일정도 한 화면에',
    body: '오늘 할 일과 이번 주 일정을 홈에서 바로 확인하고,\n일정 화면에서 우리 동네 쓰레기 배출표를 펼쳐 볼 수 있어요.',
    screens: ['home', 'calendar'],
  },
  {
    title: '새는 돈 없는 자취 가계부',
    body: '월세 · 공과금 · 식비까지 한 번에 모아 보고,\n이번 달 어디에 얼마 썼는지 그래프로 한눈에 확인해요.',
    screens: ['budget', 'home'],
  },
  {
    title: '사진 한 장이면 척척, AI 도우미',
    body: '버릴 물건, 냉장고 속 재료, 곰팡이 핀 벽까지.\n사진을 찍어 물어보면 자취 9단처럼 알려 줘요.',
    screens: ['ai', 'calendar'],
  },
  {
    title: '이웃과 나누는 우리 동네 이야기',
    body: '주변 세탁방 · 편의점 · 약국을 지도에서 찾고,\n같은 동네 이웃들의 자취 꿀팁도 구경해요.',
    screens: ['community', 'map'],
  },
]

/* ---------- 질문: 작은 불편에서 시작 (로봇 + 말풍선) ---------- */
export const QUESTION = {
  kicker: '시작은 작은 불편에서',
  title: '매일 챙기는 자취 생활,\n더 편해질까요?',
  body: '월세 날짜, 분리배출 요일, 이번 달 지출까지.\n혼자 기억하던 일을 ZIP이 대신 챙겨요.',
  /** 흰 말풍선: 자취생의 질문 */
  asks: ['월세 내는 날, 또 깜빡했어요', '이 용기, 어디에 버려요?'],
  /** 파란 말풍선: ZIP 의 답 */
  reply: '제가 대신 챙겨 드릴게요!',
}

/* ---------- 번호 붙은 기능 목록 (흰 판) ---------- */
export const FEATURE_HEAD = {
  kicker: 'FEATURES',
  title: '혼자 사는 하루에\n필요한 것만.',
  body: '일정 · 가계부 · AI · 동네 정보까지.\n자취에 꼭 필요한 기능만 골라 담았어요.',
}

export type FeatureItem = { icon: string; title: string; body: string }
export const FEATURES: FeatureItem[] = [
  { icon: '🏠', title: '홈 한눈에 보기', body: '오늘 할 일 · 날씨 · 다가오는 기념일을 첫 화면에서 바로 확인해요.' },
  { icon: '📅', title: '일정 · 할 일', body: '약속과 할 일, 쓰레기 배출 요일까지 달력 한 곳에 모아 둬요.' },
  { icon: '💸', title: '자취 가계부', body: '월세 · 공과금 같은 고정 지출은 한 번만, 월급은 자동으로 기록돼요.' },
  { icon: '🤖', title: 'AI 도우미', body: '사진을 찍어 물어보면 분리배출 · 요리 · 청소 방법을 알려 줘요.' },
  { icon: '🗺️', title: '동네 지도', body: '세탁방 · 편의점 · 약국처럼 자취에 필요한 가게를 지도에서 찾아요.' },
  { icon: '💬', title: '동네생활', body: '이웃과 자취 꿀팁을 나누고, 우리 동네 인기 글을 모아 봐요.' },
]

/* ---------- 추천 카드 (흰 판 · 2 x 2) ---------- */
export const STORIES_HEAD = {
  kicker: 'FOR YOU',
  title: '이런 분께\nZIP을 추천해요.',
  body: '처음 자취를 시작한 새내기부터 바쁜 직장인까지.\n자취하며 자주 생기는 고민을 ZIP이 챙겨요.',
}

export type BrandStory = {
  id: string
  /** 카드 위 작은 글씨 (누가 · 무엇) */
  meta: string
  title: string
  body: string
  screens: [ScreenName, ScreenName]
}

/* 추천 대상 카드: 실제 사용자 후기가 아니라 어떤 분께 맞는지 설명해요. 지금 있는 기능만 적어요. */
export const STORIES: BrandStory[] = [
  { id: 'first', meta: '처음 자취하는 분 · 월세', title: '월세 · 관리비 날짜를 자주 잊는 분', body: '납부일이 홈에 D-day로 뜨고, 알림으로 미리 알려 줘요.', screens: ['home', 'calendar'] },
  { id: 'recycle', meta: '1인 가구 · 분리배출', title: '분리배출 요일이 헷갈리는 분', body: '우리 동네 배출 요일을 알림으로 받고, 헷갈리는 건 AI에게 물어볼 수 있어요.', screens: ['ai', 'calendar'] },
  { id: 'budget', meta: '직장인 · 가계부', title: '한 달 지출이 궁금한 분', body: '고정 지출과 가계부를 한곳에서 보고, AI가 이번 달 지출을 요약해 줘요.', screens: ['budget', 'home'] },
  { id: 'town', meta: '이사 온 분 · 동네', title: '새 동네가 아직 낯선 분', body: '지도에서 세탁방 · 편의점을 찾고, ZIP 회원 리뷰와 동네 글을 볼 수 있어요.', screens: ['map', 'community'] },
]

/* ---------- 시작 3단계 ---------- */
export const STEPS_HEAD = {
  kicker: '시작은 이렇게',
  title: '세 걸음이면\n우리 집이 정리돼요.',
  body: '처음 한 번만 적어 두면, 그다음부터는 ZIP이 알아서 챙겨요.',
}

export type StepItem = { title: string; body: string }
export const STEPS: StepItem[] = [
  { title: '우리 집을 알려 주세요.', body: '가입하고 사는 곳 · 계약 정보 · 수입을 짧은 설문으로 적어요.' },
  { title: '고정 지출과 일정을 담아요.', body: '월세 · 관리비 · 통신비, 기념일과 할 일을 한 번만 등록해요.' },
  { title: '매일 홈에서 챙겨요.', body: '납부일 · 배출 요일 · 할 일을 홈과 알림으로 놓치지 않아요.' },
]

/* ---------- 7. 마지막 화면 ---------- */
export const CTA = {
  kicker: '다음 자취는 ZIP과 함께',
  title: '오늘부터,\nZIP에서 살아 볼까요?',
  body: '로그인하면 내 일정, 할 일, 공과금을 이어서 볼 수 있어요.',
  bubble: '같이 챙겨 볼까요?',
}
