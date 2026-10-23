import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/* 이용 정지 · 경고 기록 (팀장님 시안 shared/zip-ban.js 와 같은 규칙). 서버가 없어서 이 브라우저에만 저장됩니다.
 * - 정지: 1 · 3 · 5 · 10일 또는 영구. 걸 때마다 횟수(count)가 늘고 이력(history)이 남아요. 기간이 끝나면 저절로 풀려도 횟수·이력은 그대로.
 * - 경고: 정지 없이 기록만 (warns 따로 셈)
 * - 저장 키는 일부러 zip- 으로 시작하지 않는 'zipban-records': 데이터 초기화·회원 탈퇴로 지워지지 않게 (초기화로 정지를 푸는 꼼수 방지)
 * 실제 서비스에서는 서버의 user_sanctions 표(DB)로 대신합니다. */

export type SanctionEntry = {
  at: number
  /** 정지 일수. null 이면 영구(또는 경고) */
  days: number | null
  reason: string
  warn?: boolean
}

export type BanRecord = {
  nick: string
  /** 아이디 · 휴대전화(숫자만)는 알면 같이 저장 → 같은 정보로 재가입 막기 */
  uid?: string
  phone?: string
  /** 정지 횟수 */
  count: number
  /** 경고 횟수 */
  warns: number
  perm: boolean
  /** 정지 풀리는 시각 (ms) */
  until: number | null
  history: SanctionEntry[]
}

const DAY = 86400000
const empty = (nick: string): BanRecord => ({ nick, count: 0, warns: 0, perm: false, until: null, history: [] })

type State = {
  /** 닉네임 → 기록 */
  records: Record<string, BanRecord>
  /** days = 1·3·5·10, 0 이면 영구 */
  ban: (nick: string, days: number, reason: string, info?: { uid?: string; phone?: string }) => void
  warn: (nick: string, reason: string) => void
  /** 정지 풀기 (횟수·이력은 남김) */
  unban: (nick: string) => void
}

export const useBanStore = create<State>()(
  persist(
    (set) => ({
      records: {},
      ban: (nick, days, reason, info) =>
        set((s) => {
          const r = { ...(s.records[nick] ?? empty(nick)) }
          if (info?.uid) r.uid = info.uid
          if (info?.phone) r.phone = info.phone.replace(/\D/g, '')
          r.count += 1
          r.perm = !days
          r.until = days ? Date.now() + days * DAY : null
          r.history = [...r.history, { at: Date.now(), days: days || null, reason }]
          return { records: { ...s.records, [nick]: r } }
        }),
      warn: (nick, reason) =>
        set((s) => {
          const r = { ...(s.records[nick] ?? empty(nick)) }
          r.warns += 1
          r.history = [...r.history, { at: Date.now(), days: null, reason, warn: true }]
          return { records: { ...s.records, [nick]: r } }
        }),
      unban: (nick) =>
        set((s) => (s.records[nick] ? { records: { ...s.records, [nick]: { ...s.records[nick], perm: false, until: null } } } : s)),
    }),
    { name: 'zipban-records', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
)
