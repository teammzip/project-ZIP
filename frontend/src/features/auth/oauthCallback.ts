export function readOAuthCallback(search: string, hash: string) {
  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  return { token: fragment.get('token') || null, error: query.get('error'), hasQueryToken: query.has('token') }
}
