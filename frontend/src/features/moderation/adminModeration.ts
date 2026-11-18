import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { isMockApi } from '@/features/auth'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { toSanctionEntry } from './rules'
import { useBanStore, type BanRecord, type SanctionEntry } from './store'

/* 관리자 회원 관리의 정지 · 경고 데이터. 가짜 API 모드는 이 브라우저(useBanStore), 서버 모드는 /api/admin/members · sanctions · stats.
 * 서버 회원 목록을 화면이 쓰는 BanRecord(닉네임 → 기록) 모양으로 바꿔서, 관리자 화면 코드는 그대로 써요. */

type ServerMember = {
  id: string
  nickname: string
  username: string | null
  /** 가입 방식. 소셜 가입은 username 이 없어서 화면이 이 값으로 어디로 가입했는지 보여 줘요 */
  provider: string
  joinedAt: string | null
  posts: number
  comments: number
  warns: number
  bans: number
  status: 'ACTIVE' | 'SUSPENDED'
  until: string | null
  permanent: boolean
}
type ServerSanction = { id: string; type: 'WARNING' | 'SUSPEND' | 'BAN'; days: number | null; reason: string; startsAt: string }
export type AdminStats = { members: number; suspended: number; totalBans: number; totalWarns: number; posts: number; comments: number }

const KEY = ['admin', 'moderation'] as const

/** 회원 전체 (50명씩, 최대 1000명) */
async function allMembers() {
  const items: ServerMember[] = []
  for (let page = 0; page < 20; page++) {
    const data = (await apiClient.get<{ items: ServerMember[]; hasNext: boolean }>('/admin/members', { params: { page, sort: 'joined' } })).data
    items.push(...data.items)
    if (!data.hasNext) break
  }
  return items
}

const toRecord = (m: ServerMember, history: SanctionEntry[]): BanRecord => ({
  nick: m.nickname,
  uid: m.username ?? '',
  provider: m.provider,
  count: m.bans,
  warns: m.warns,
  perm: m.status === 'SUSPENDED' && m.permanent,
  until: m.status === 'SUSPENDED' && m.until ? Date.parse(m.until) : null,
  history,
})

export function useAdminModeration() {
  const local = useBanStore()
  const client = useQueryClient()
  const members = useQuery({ queryKey: [...KEY, 'members'], queryFn: allMembers, enabled: !isMockApi })
  const stats = useQuery({ queryKey: [...KEY, 'stats'], queryFn: async () => (await apiClient.get<AdminStats>('/admin/stats')).data, enabled: !isMockApi })
  /** 기록 버튼을 누른 회원만 조치 이력을 받아 둠 (닉네임 → 이력) */
  const [histories, setHistories] = useState<Record<string, SanctionEntry[]>>({})

  if (isMockApi) {
    return { records: local.records, ban: local.ban, warn: local.warn, unban: local.unban, server: null, loadHistory: undefined, error: false }
  }

  const list = members.data ?? []
  const byNick = new Map(list.map((m) => [m.nickname, m]))
  const records: Record<string, BanRecord> = Object.fromEntries(list.map((m) => [m.nickname, toRecord(m, histories[m.nickname] ?? [])]))

  const loadHistory = async (nick: string) => {
    const m = byNick.get(nick)
    if (!m) return
    const data = (await apiClient.get<ServerSanction[]>(`/admin/members/${m.id}/sanctions`)).data
    // 화면은 오래된 것부터 받아서 거꾸로 보여 줘요
    const entries = [...data].reverse().map((s) => toSanctionEntry(s, s.startsAt))
    setHistories((h) => ({ ...h, [nick]: entries }))
  }
  /** 서버에 보내고 목록 · 숫자 · (열려 있던) 이력을 새로. 실패하면 알림 */
  const send = async (nick: string, work: (id: string) => Promise<unknown>) => {
    const m = byNick.get(nick)
    if (!m) return window.alert(`'${nick}' 회원을 서버에서 찾지 못했어요. 새로고침해 주세요.`)
    try {
      await work(m.id)
      await client.invalidateQueries({ queryKey: KEY })
      if (histories[nick]) await loadHistory(nick)
    } catch (error) {
      window.alert(getErrorMessage(error))
    }
  }

  return {
    records,
    /** days: 1 · 3 · 5 · 10, 0 이면 영구 정지 */
    ban: (nick: string, days: number, reason: string) =>
      void send(nick, (id) => apiClient.post(`/admin/members/${id}/sanctions`, days ? { type: 'SUSPEND', days, reason } : { type: 'BAN', reason })),
    warn: (nick: string, reason: string) => void send(nick, (id) => apiClient.post(`/admin/members/${id}/sanctions`, { type: 'WARNING', reason })),
    unban: (nick: string) => void send(nick, (id) => apiClient.delete(`/admin/members/${id}/sanctions/active`)),
    /** 서버 모드: 회원별 글 · 댓글 수 · 가입일, 관리자 첫 화면 숫자 */
    server: {
      counts: Object.fromEntries(list.map((m) => [m.nickname, { posts: m.posts, cmts: m.comments, joinedAt: m.joinedAt ?? '-' }])) as Record<string, { posts: number; cmts: number; joinedAt: string }>,
      stats: stats.data,
    },
    loadHistory,
    error: members.isError || stats.isError,
  }
}
