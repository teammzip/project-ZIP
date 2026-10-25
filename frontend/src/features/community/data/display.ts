/* 커뮤니티 화면에 쓰는 작은 표시 규칙 */

/** 주제 칩 그림 */
export const CAT_ICON: Record<string, string> = { 자유: '💬', 꿀팁: '💡', 질문: '❓', 동네: '🏘️' }

/** '서울 마포구' → '마포구' */
export const shortRegion = (region: string) => region.split(' ').pop() ?? region
