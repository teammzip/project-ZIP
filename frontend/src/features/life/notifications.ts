import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingContract } from '@/features/onboarding/useHousingContract'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { relTime } from '@/lib/date'
import { buildMockRentNoti, buildNotis, type Noti } from './derive'
import { useLifeStore } from './store'

/* 서버 알림은 id 앞에 's'를 붙이고 읽음 · 삭제를 서버에 저장해요.
 * 목업 모드의 일정 · 월세 알림은 브라우저에서 계산하고 읽음 · 삭제를 zip-life에 저장해요. */

type ServerNoti = {
  id: string
  type: 'EVENT' | 'TRASH' | 'RENT' | 'BILL' | 'COMMUNITY' | 'SYSTEM'
  title: string
  body: string | null
  link: string | null
  refId: string | null
  notifyAt: string
  read: boolean
}

const KEY = ['notifications'] as const
const SERVER = 's'
const ICONS: Record<ServerNoti['type'], string> = { EVENT: '📌', TRASH: '♻️', RENT: '💸', BILL: '🧾', COMMUNITY: '💬', SYSTEM: '📢' }

/** 일정은 알림의 날짜, 월세는 납부 대상 월, 공지는 공지 번호로 이동해요. */
const linkTo = (n: ServerNoti) =>
  n.link === 'community' ? (n.refId ? `/community?post=${n.refId}` : '/community')
  : n.link === 'support' ? `/my/settings/support${n.refId ? `/${n.refId}` : ''}`
  : n.link === 'notice' ? `/my/settings/notices${n.refId ? `/${n.refId}` : ''}`
  : n.type === 'EVENT' && n.link && /^calendar:\d{4}-\d{2}-\d{2}$/.test(n.link)
    ? `/my/calendar?date=${n.link.slice(9)}`
  : n.link === 'budget' && n.type === 'RENT' && n.refId && /^\d{4}(0[1-9]|1[0-2])$/.test(n.refId)
    ? `/my/budget/expense?month=${n.refId.slice(0, 4)}-${n.refId.slice(4)}`
  : n.type === 'RENT' && n.link && /^budget:\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(n.link)
    ? `/my/budget/expense?month=${n.link.slice(7, 14)}`
  : undefined

const serverId = (id: string) => (id.startsWith(SERVER) ? id.slice(SERVER.length) : null)

function useServerNotis() {
  const userId = useAuthStore((s) => s.user?.id)
  return useQuery({
    queryKey: [...KEY, userId],
    queryFn: async () => (await apiClient.get<{ items: ServerNoti[]; unreadCount: number }>('/notifications')).data,
    enabled: !isMockApi && !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000, // 새 댓글 알림이 화면을 새로고침하지 않아도 들어오게
  })
}

/** 알림 목록 + 안 읽은 개수 (알림을 끄면 빨간 점은 안 보이게 showDot=false) */
export function useNotis() {
  const { kind } = useHousingContract()
  const { events, settings, notiRead, notiDeleted, rentPaid } = useLifeStore(useShallow((s) => ({ events: s.events, settings: s.settings, notiRead: s.notiRead, notiDeleted: s.notiDeleted, rentPaid: s.rentPaid })))
  const server = useServerNotis()
  const calculated = isMockApi ? buildNotis(events) : []
  if (isMockApi) {
    const mockRent = buildMockRentNoti(settings, rentPaid, kind)
    if (mockRent) calculated.push(mockRent)
  }
  const local = calculated.filter((n) => !notiDeleted?.[n.id]) // 저장된 예전 데이터엔 notiDeleted 가 없을 수 있음
  const remote: Noti[] = (server.data?.items ?? []).map((n) => ({
    id: SERVER + n.id,
    ico: ICONS[n.type] ?? '🔔',
    t: n.title,
    s: n.body ?? '',
    time: relTime(Date.parse(n.notifyAt)),
    to: linkTo(n),
  }))
  const read: Record<string, boolean> = { ...notiRead }
  for (const n of server.data?.items ?? []) if (n.read) read[SERVER + n.id] = true
  const notis = [...remote, ...local]
  const unread = notis.filter((n) => !read[n.id]).length
  return { notis, notiRead: read, unread, showDot: settings.notiOn && unread > 0 }
}

/** 읽음 · 지우기: 서버 알림은 서버에, 나머지는 이 브라우저에 */
export function useNotiActions() {
  const client = useQueryClient()
  const markLocal = useLifeStore((s) => s.markRead)
  const deleteLocal = useLifeStore((s) => s.deleteNotis)
  const split = (ids: string[]) => ({
    remote: ids.map(serverId).filter((id): id is string => !!id),
    local: ids.filter((id) => !serverId(id)),
  })
  const refresh = () => client.invalidateQueries({ queryKey: KEY })
  return {
    markRead: async (ids: string[]) => {
      const { remote, local } = split(ids)
      if (local.length) markLocal(local)
      if (remote.length) {
        await apiClient.patch('/notifications/read', { ids: remote })
        await refresh()
      }
    },
    /** 읽은 알림 지우기 */
    deleteNotis: async (ids: string[]) => {
      const { remote, local } = split(ids)
      if (local.length) deleteLocal(local)
      if (remote.length) {
        await apiClient.delete('/notifications', { params: { ids: remote.join(',') } })
        await refresh()
      }
    },
  }
}
