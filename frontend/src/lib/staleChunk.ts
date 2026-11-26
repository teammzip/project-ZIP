/* 배포 직후 "옛 화면 파일을 못 찾는" 오류를 알아보고, 한 번만 자동 새로고침할지 정한다.
 * 화면 코드는 그 주소에 처음 갈 때 받아 오는데(app/router.tsx 의 lazy), 새 버전을 올리면 옛 파일 이름이 사라져서
 * 예전 화면을 열어 둔 사용자가 다른 메뉴로 가면 파일을 받지 못하고 오류가 난다. 새로고침하면 새 파일로 다시 받는다. */

// 브라우저마다 오류 문구가 다름 (Chrome · Edge / Safari / Firefox / Vite 의 CSS 미리 받기)
const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

export function isStaleChunkError(error: unknown) {
  // instanceof Error 대신 message 로 판별: 다른 창 · 실행 공간에서 만든 오류 객체도 알아봄
  const message = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : ''
  return STALE_CHUNK.test(message)
}

const RELOAD_KEY = 'zip-stale-chunk-reload'
// 이 시간 안에 또 실패하면 자동 새로고침을 하지 않음 (서버에 정말 파일이 없을 때 무한 새로고침 방지)
const RELOAD_GAP_MS = 10_000

type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'> | undefined

/** 이 탭의 sessionStorage. 사이트 데이터를 막은 브라우저는 꺼내기만 해도 오류가 나서 감쌈 */
export function tabStorage(): ReloadStorage {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

/** 이 탭에서 방금 자동 새로고침을 하지 않았는지 (읽기만 함 — 화면을 그릴 때 불러도 됨). 저장소를 못 쓰면 false (새로고침 버튼만 보여 줌) */
export function canAutoReload(storage: ReloadStorage, now = Date.now()) {
  try {
    return !!storage && now - Number(storage.getItem(RELOAD_KEY) ?? 0) >= RELOAD_GAP_MS
  } catch {
    return false
  }
}

/** 자동 새로고침 직전에 시각을 남김 (effect 안에서 부름) */
export function markAutoReload(storage: ReloadStorage, now = Date.now()) {
  try {
    storage?.setItem(RELOAD_KEY, String(now))
  } catch {
    // 저장소를 못 쓰면 canAutoReload 가 이미 false 라 여기까지 오지 않음
  }
}
