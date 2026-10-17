/* 브랜드 스토리 문구와 카드 내용. 문구를 바꿀 때는 이 파일만 고치면 됩니다.
 * (기존 시안 variants/start-pc 의 문구를 바탕으로 정리) */

export const HERO = {
  kicker: '자취생 생활 도우미',
  lines: ['혼자 사는 모두,', 'ZIP에 산다'],
  sub: '일정, 공과금, 쓰레기 배출까지.\n자취 생활에 필요한 것만 모아 ZIP이 챙겨 드려요.',
}

export const INTRO = {
  kicker: '어서와요, ZIP은 처음이죠?',
  text: '월세 날짜는 메모장에, 공과금은 문자함에, 분리배출 요일은 현관 앞 종이에. 흩어져 있던 자취 생활을 한곳에 모았어요. 이제 기억하는 건 ZIP이 할게요.',
}

export type BrandValue = {
  id: string
  label: string
  title: string
  body: string
  emoji: string
  /** 오른쪽 그림 패널 배경색 */
  tint: string
  /** 그림 패널 안에 보여줄 앱 화면 미리보기 한 줄들 */
  preview: string[]
}

export const VALUES_HEAD = {
  kicker: 'ZIP이 챙기는 네 가지',
  title: '자취의 귀찮음을\n하나씩 덜어 드려요',
}

export const VALUES: BrandValue[] = [
  {
    id: 'schedule',
    label: '일정 · 할 일',
    title: '까먹지 않게\n한눈에 보여줘요',
    body: '오늘 할 일과 이번 주 일정을 홈 화면에서 바로 확인하고, 끝낸 일은 체크하면 끝.',
    emoji: '📅',
    tint: '#eaf2fe',
    preview: ['오늘 할 일 3개', '✓ 욕실 청소', '재활용 분리배출'],
  },
  {
    id: 'bills',
    label: '월세 · 공과금',
    title: '납부일 전에\n먼저 알려줘요',
    body: '월세일과 공과금 납부일을 한 번만 등록하면 매달 잊지 않게 알림이 오고, 이번 달 납부 현황도 보여요.',
    emoji: '💸',
    tint: '#fff0f3',
    preview: ['월세 D-3', '✓ 가스 28,000원', '수도 32,000원'],
  },
  {
    id: 'trash',
    label: '쓰레기 배출',
    title: '버리는 날을\n놓치지 않게',
    body: '우리 동네 분리배출 요일을 알려 주고, 헷갈리는 쓰레기는 사진 한 장으로 물어볼 수 있어요.',
    emoji: '🗑️',
    tint: '#eefaf8',
    preview: ['오늘 · 플라스틱', '내일 · 일반쓰레기', '음식물 · 매일'],
  },
  {
    id: 'ai',
    label: 'AI 도우미',
    title: '사진 한 장이면\n척척 알려줘요',
    body: '분리배출 방법, 냉장고 속 재료로 만드는 요리, 생활 꿀팁까지 물어보면 바로 대답해요.',
    emoji: '🤖',
    tint: '#f1efff',
    preview: ['이 용기 어떻게 버려요?', '냉장고 재료로 요리 추천', '욕실 곰팡이 청소법'],
  },
]

export const SHOWCASE = {
  kicker: '한 화면에',
  title: '자취 생활의 모든 것,\n홈 하나로',
}

export type BrandStory = {
  id: string
  tag: string
  title: string
  quote: string
  author: string
  emoji: string
  /** 사진이 들어갈 자리의 배경 (사진이 생기면 image 로 바꾸기) */
  gradient: string
}

export const STORIES_HEAD = {
  kicker: '우리 동네 꿀팁까지',
  title: '모두의 자취 이야기로\n함께 채워가요',
  body: '주변 세탁방과 편의점을 지도에서 찾고, 이웃들이 올린 자취 꿀팁도 구경해요.',
}

/* TODO: 예시 문구입니다. 실제 사용자 후기와 사진이 생기면 바꿔 주세요. */
export const STORIES: BrandStory[] = [
  {
    id: 'first',
    tag: '첫 자취',
    title: '첫 자취, 월세 날짜만큼은 안 까먹어요',
    quote: '납부일 사흘 전에 알림이 와서 연체할 일이 없어졌어요.',
    author: '마포구 새내기',
    emoji: '🏠',
    gradient: 'linear-gradient(135deg, #cfe3ff 0%, #8fbaf7 100%)',
  },
  {
    id: 'recycle',
    tag: '분리배출',
    title: '헷갈리던 분리배출, 사진 한 장으로 끝',
    quote: '배달 용기 버릴 때마다 사진 찍어서 물어봐요.',
    author: '합정동 1인 가구',
    emoji: '♻️',
    gradient: 'linear-gradient(135deg, #d4f5ef 0%, #7fd6c8 100%)',
  },
  {
    id: 'budget',
    tag: '가계부',
    title: '공과금까지 합치니 한 달 지출이 보여요',
    quote: '고정 지출이 한눈에 보이니까 아낄 곳이 보이더라고요.',
    author: '망원동 직장인',
    emoji: '📊',
    gradient: 'linear-gradient(135deg, #ffe0e7 0%, #ff9db3 100%)',
  },
  {
    id: 'town',
    tag: '동네',
    title: '이사 오자마자 세탁방부터 찾았어요',
    quote: '이웃들이 올린 꿀팁 덕분에 동네에 금방 익숙해졌어요.',
    author: '연남동 자취 2년 차',
    emoji: '🗺️',
    gradient: 'linear-gradient(135deg, #fff1cc 0%, #ffd36b 100%)',
  },
  {
    id: 'cook',
    tag: '요리',
    title: '냉장고 털이 레시피로 식비 줄이기',
    quote: '남은 재료 사진을 올리면 오늘 저녁 메뉴가 나와요.',
    author: '서교동 자취생',
    emoji: '🍳',
    gradient: 'linear-gradient(135deg, #e6e1ff 0%, #a99cf7 100%)',
  },
]

export const CTA = {
  title: '이제\n집으로 들어가요',
  body: '로그인하면 내 일정, 할 일, 공과금을 이어서 볼 수 있어요.',
}
