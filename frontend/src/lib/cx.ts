/** className 합치기: cx('a', on && 'b', undefined) → 'a b' */
export function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ')
}
