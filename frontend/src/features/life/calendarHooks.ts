/* 일정 카테고리 · 항목 버튼 변경을 서버 동기화(calendarSync.ts)에 알려 주는 통로. 저장소(store.ts)가 부르고, 서버 모드일 때만 연결돼요.
 * 카테고리 이름 바꾸기 · 지우기는 "무엇을 바꿨는지"가 중요해서(목록만 비교하면 지우고 새로 만든 것처럼 보임) 동작 그대로 넘겨요. */

export type CategoryOp =
  | { type: 'addCategory'; name: string }
  | { type: 'renameCategory'; from: string; to: string }
  | { type: 'deleteCategory'; name: string }
  | { type: 'addPreset'; id: string; title: string; category: string }
  | { type: 'updatePreset'; id: string; title: string; category: string }
  | { type: 'removePreset'; id: string }

export const calendarHooks: { onOp: ((op: CategoryOp) => void) | null; quiet: boolean } = { onOp: null, quiet: false }

/** 이 변경으로 생긴 일정 변화는 서버에 따로 보내지 않음 (카테고리 이름 바꾸기 · 지우기는 서버가 그 일정도 같이 옮김) */
export function quietly(apply: () => void) {
  calendarHooks.quiet = true
  try {
    apply()
  } finally {
    calendarHooks.quiet = false
  }
}
