/* localStorage / sessionStorage 를 안전하게 읽고 쓰기 (사생활 보호 모드 등에서 에러가 나도 앱이 멈추지 않게).
 * 키 이름은 기존 시안과 같이 zip- 으로 시작합니다. */
type StorageKind = 'local' | 'session'

function pick(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJSON<T>(key: string, kind: StorageKind = 'local'): T | null {
  try {
    const raw = pick(kind)?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJSON(key: string, value: unknown, kind: StorageKind = 'local') {
  try {
    pick(kind)?.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function remove(key: string, kind: StorageKind = 'local') {
  try {
    pick(kind)?.removeItem(key)
  } catch {
    /* 무시 */
  }
}
