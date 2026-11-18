import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingContract } from '@/features/onboarding/useHousingContract'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { relTime } from '@/lib/date'
import { buildNotis, type Noti } from './derive'
import { useLifeStore } from './store'

/* 알림 = 브라우저가 계산하는 알림(일정 · 쓰레기 배출 · 월세, buildNotis) + 서버 알림(서버 모드: 댓글 · 답글 · 운영자 조치 · 경고 · 문의 답변).
 * 서버 알림 id 는 앞에 's' 를 붙여 구분하고, 읽음 · 지우기는 서버 알림이면 /api/notifications, 아니면 이 브라우저(zip-life)에 저장해요. */

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

/** 서버 알림을 누르면 열 화면 */
const linkTo = (n: ServerNoti) =>
  n.link === 'community' ? (n.refId ? `/community?post=${n.refId}` : '/community')
  : n.link === 'support' ? `/my/settings/support${n.refId ? `/${n.refId}` : ''}`
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
  const { events, settings, notiRead, notiDeleted } = useLifeStore(useShallow((s) => ({ events: s.events, settings: s.settings, notiRead: s.notiRead, notiDeleted: s.notiDeleted })))
  const server = useServerNotis()
  const local = buildNotis(events, settings, kind).filter((n) => !notiDeleted?.[n.id]) // 저장된 예전 데이터엔 notiDeleted 가 없을 수 있음
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
