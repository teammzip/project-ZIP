/* 시작 화면(브랜드 스토리) 문구와 그림 데이터. 문구를 바꿀 때는 이 파일만 고치면 됩니다.
 * 구성은 오늘의집 브랜드 페이지(https://events.ohou.se/brand)의 흐름을 참고했어요.
 * 사진이 아직 없어서 그림 자리는 이모지 일러스트 카드와 앱 화면 그림(Phone)으로 채웠어요.
 * TODO: 실제 사진이 생기면 각 카드의 image 에 주소를 넣으면 사진으로 바뀌어요. */
import type { ScreenName } from './components/Phone'

/* ---------- 1. 첫 화면 ---------- */
export const HERO = {
  kicker: '자취생 생활 도우미 ZIP',
  lines: ['어서와요', '새로운 ZIP이에요'],
}

/** 첫 화면 주변에 떠 있는 카드. x · y 는 화면 기준 %, w 는 너비(px), speed 는 스크롤할 때 움직이는 정도 */
export type FloatTile =
  | { kind: 'illust'; emoji: string; bg: string; x: number; y: number; w: number; h: number; speed: number; image?: string }
  | { kind: 'widget'; icon: string; label: string; value: string; tone: string; x: number; y: number; w: number; speed: number }
  | { kind: 'robot' | 'house'; x: number; y: number; w: number; speed: number }

export const HERO_TILES: FloatTile[] = [
  { kind: 'illust', emoji: '🛋️', bg: 'linear-gradient(160deg,#ffe3d3,#ffb999)', x: 2, y: 6, w: 150, h: 190, speed: 120 },
  { kind: 'widget', icon: '💸', label: '월세 납부일', value: 'D-3', tone: '#7c6cf5', x: 15, y: 16, w: 168, speed: 60 },
  { kind: 'illust', emoji: '🪴', bg: 'linear-gradient(160deg,#dff5e3,#9fdcae)', x: 64, y: 8, w: 120, h: 160, speed: 90 },
  { kind: 'illust', emoji: '💡', bg: 'linear-gradient(160deg,#fff4cc,#ffd76b)', x: 80, y: 4, w: 200, h: 230, speed: 160 },
  { kind: 'robot', x: 84, y: 54, w: 190, speed: 80 },
  { kind: 'widget', icon: '♻️', label: '오늘 배출', value: '재활용', tone: '#1fb5a3', x: 66, y: 72, w: 170, speed: 140 },
  { kind: 'illust', emoji: '🍳', bg: 'linear-gradient(160deg,#ffe7ea,#ff9db3)', x: 46, y: 80, w: 220, h: 150, speed: 70 },
  { kind: 'house', x: 1, y: 50, w: 170, speed: 110 },
  { kind: 'widget', icon: '✅', label: '오늘 할 일', value: '3개 남음', tone: '#2f80ed', x: 13, y: 66, w: 176, speed: 50 },
  { kind: 'illust', emoji: '🧺', bg: 'linear-gradient(160deg,#e3eeff,#9ec2ff)', x: 28, y: 84, w: 130, h: 120, speed: 130 },
]

/* ---------- 2. 카드 구름 → 로고 ---------- */
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
  { line: '월세 · 공과금은 잊기 전에,', caption: '새는 돈 없는\n자취 가계부', screen: 'budget', tint: '#f1efff' },
  { line: '헷갈리는 분리배출은 사진 한 장으로,', caption: '사진 한 장이면\n척척 알려 주는 AI', screen: 'ai', tint: '#eefaf8' },
  { line: '이웃과 나누는 동네 이야기까지', caption: '우리 동네 꿀팁을\n이웃과 함께', screen: 'community', tint: '#fff0f3' },
  { line: '자취가 훨씬 쉬워집니다', caption: '혼자여도\n든든한 하루', screen: 'home', tint: '#fff8e1' },
]

/* ---------- 5. 휴대폰 두 대 + 큰 제목 (번갈아) ---------- */
export type ShowcaseRow = { title: string; body: string; screens: [ScreenName, ScreenName] }
export const SHOWCASE_ROWS: ShowcaseRow[] = [
  {
    title: '할 일도, 일정도 한 화면에',
    body: '오늘 할 일과 이번 주 일정을 홈에서 바로 확인하고,\n끝낸 일은 체크하면 끝. 쓰레기 배출 요일도 달력에 저절로 보여요.',
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

/* ---------- 6. 이야기 카드 ---------- */
export const STORIES_HEAD = {
  title: '모두의 자취 이야기로\n함께 채워가요',
}

export type BrandStory = {
  id: string
  title: string
  author: string
  emoji: string
  /** 사진이 들어갈 자리의 배경 (사진이 생기면 image 에 주소) */
  gradient: string
  image?: string
  /** 카드 크기: tall(세로로 큼) · wide(가로로 큼) · small */
  size: 'tall' | 'wide' | 'small'
}

/* TODO: 예시 문구입니다. 실제 사용자 후기와 사진이 생기면 바꿔 주세요. */
export const STORIES: BrandStory[] = [
  { id: 'first', title: '첫 자취, 월세 날짜만큼은\n안 까먹어요', author: '마포구 새내기', emoji: '🏠', gradient: 'linear-gradient(160deg,#cfe3ff 0%,#8fbaf7 100%)', size: 'tall' },
  { id: 'recycle', title: '헷갈리던 분리배출,\n사진 한 장으로 끝', author: '합정동 1인 가구', emoji: '♻️', gradient: 'linear-gradient(160deg,#d4f5ef 0%,#7fd6c8 100%)', size: 'small' },
  { id: 'budget', title: '공과금까지 합치니\n한 달 지출이 보여요', author: '망원동 직장인', emoji: '📊', gradient: 'linear-gradient(160deg,#ffe0e7 0%,#ff9db3 100%)', size: 'wide' },
  { id: 'cook', title: '냉장고 털이 레시피로\n식비 줄이기', author: '서교동 자취생', emoji: '🍳', gradient: 'linear-gradient(160deg,#e6e1ff 0%,#a99cf7 100%)', size: 'tall' },
  { id: 'town', title: '이사 오자마자\n세탁방부터 찾았어요', author: '연남동 자취 2년 차', emoji: '🧺', gradient: 'linear-gradient(160deg,#fff1cc 0%,#ffd36b 100%)', size: 'wide' },
]

/* ---------- 7. 마지막 화면 ---------- */
export const CTA = {
  title: '이제\n집으로 들어가요',
  body: '로그인하면 내 일정, 할 일, 공과금을 이어서 볼 수 있어요.',
}
