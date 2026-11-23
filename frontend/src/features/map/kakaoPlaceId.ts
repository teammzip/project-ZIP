const PREFIX = 'kakao:'
const ID = /^[0-9]{1,50}$/

export function toKakaoPlaceKey(id: string): string | null {
  return ID.test(id) ? `${PREFIX}${id}` : null
}

export function getKakaoPlaceId(key: string): string | null {
  if (!key.startsWith(PREFIX)) return null
  const id = key.slice(PREFIX.length)
  return ID.test(id) ? id : null
}

export const isKakaoPlace = (key: string) => getKakaoPlaceId(key) !== null
