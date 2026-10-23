/* 정지 기록을 읽는 규칙 (화면 · 가짜 API 가 같이 씀) */
import { useBanStore, type BanRecord } from './store'

const DAY = 86400000
const two = (n: number) => String(n).padStart(2, '0')

/** '10/23 18:00' */
export const fmtAt = (ts: number) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`
}

/** 지금 정지 중인지 (영구이거나 해제 시각이 아직 안 지남) */
export const isActive = (r?: BanRecord | null): r is BanRecord => !!r && (r.perm || (!!r.until && r.until > Date.now()))

/** '영구 정지' · '3일 남음' · '정상' */
export function banLabel(r?: BanRecord | null) {
  if (!isActive(r)) return '정상'
  if (r.perm) return '영구 정지'
  return `${Math.ceil((r.until! - Date.now()) / DAY)}일 남음`
}

/** 사용자에게 보여 줄 안내 문구 */
export function banMessage(r: BanRecord) {
  const bans = r.history.filter((e) => !e.warn)
  const why = bans.at(-1)?.reason
  return `이용이 정지된 계정이에요. ${r.perm ? '(영구 정지)' : `(${fmtAt(r.until!)} 해제)`}${why ? ` 사유: ${why}` : ''}`
}

/** 닉네임 · 아이디 · 휴대전화 중 하나라도 정지 중인 기록과 맞으면 그 기록 */
export function findActiveBan(who: { nicks?: string[]; uid?: string; phone?: string }) {
  const digits = who.phone?.replace(/\D/g, '')
  return (
    Object.values(useBanStore.getState().records).find(
      (r) => isActive(r) && ((who.nicks ?? []).includes(r.nick) || (!!who.uid && r.uid === who.uid) || (!!digits && r.phone === digits)),
    ) ?? null
  )
}

/** 화면에서: 이 사람이 지금 정지 중이면 그 기록 (기록이 바뀌면 다시 그림) */
export function useActiveBan(nick?: string, uid?: string) {
  const records = useBanStore((s) => s.records)
  if (!nick && !uid) return null
  return Object.values(records).find((r) => isActive(r) && (r.nick === nick || (!!uid && r.uid === uid))) ?? null
}
