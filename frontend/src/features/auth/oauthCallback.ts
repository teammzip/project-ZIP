/** 새 서버는 fragment를 사용한다. 구버전 서버의 query도 배포 전환 중 읽을 수 있다. */
export function readOAuthCallback(search: string, hash: string) {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  return { token: fragment.get('token') || query.get('token'), error: query.get('error') }
}
