import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { rejected, RETRY_DELAYS, startListSync, syncStorage, type SyncId } from '@/lib/listSync'
import { createSaveRecovery } from '@/lib/saveRecovery'
import { calendarHooks, type CategoryOp } from './calendarHooks'
import { UNCATEGORIZED } from './data/presets'
import { useLifeStore } from './store'
import type { CalEvent, CustomPreset, EventCategory } from './types'

/* 서버 모드 일정 동기화 (frontend/API.md 3장). 화면은 지금처럼 useLifeStore 를 쓰고 여기서 서버와 맞춰요.
 * - 일정: 공통 엔진(lib/listSync) — 바뀐 일정을 기억해 두었다가 보내고, 실패해도 잃지 않음
 * - 카테고리 · 항목 버튼: 저장소가 알려 주는 동작(추가 · 이름 바꾸기 · 지우기)을 차례대로 서버에 보냄.
 *   일정은 카테고리를 이름으로 보내서, 카테고리 저장이 끝난 뒤에 보내요(없는 이름이라고 거절되지 않게).
 * - 서버와 맞춘 적 없는 브라우저의 직접 만든 카테고리 · 항목 버튼 · 일정은 처음 한 번 서버로 옮겨요. */

type ServerEvent = { id: string; date: string; time: string; title: string; category: string | null; done: boolean; anniv: boolean; yearly: boolean }
type ServerCategory = { id: string; name: string; ico: string; system: boolean; items: string[] }
type ServerPreset = { id: string; title: string; category: string }

const toEvent = (e: ServerEvent): CalEvent => ({
  id: Number(e.id),
  date: e.date,
  time: e.time,
  title: e.title,
  done: e.done,
  ...(e.category ? { category: e.category } : {}),
  ...(e.anniv ? { anniv: true } : {}),
  ...(e.yearly ? { yearly: true } : {}),
})

const fields = (e: CalEvent) => ({
  date: e.date,
  time: e.time ?? '',
  title: e.title,
  category: e.category ?? '',
  anniv: !!e.anniv,
  yearly: !!e.yearly,
  done: !!e.done,
})

/** 이 기기 기록 초기화처럼 서버에 보내면 안 되는 변경: 보내지 않고, 끝나면 서버 값을 다시 받음 */
let externalChange: { mute: boolean; after: (() => void) | null } = { mute: false, after: null }
let retryEventSave: ((item: CalEvent, target: SyncId | null) => Promise<void>) | null = null
export const eventRecovery = createSaveRecovery<CalEvent>('zip-event-save-drafts')

export async function retryEventDraft(item: CalEvent, target: SyncId | null) {
  if (!retryEventSave) throw new Error('일정을 불러오는 중이에요. 잠시 뒤 다시 저장해 주세요.')
  await retryEventSave(item, target)
}

export function withoutCalendarSync(apply: () => void) {
  externalChange.mute = true
  try {
    apply()
  } finally {
    externalChange.mute = false
  }
  if (!isMockApi) eventRecovery.clear()
  externalChange.after?.()
}

export function startCalendarSync(userId: string, setTimer: typeof setTimeout = setTimeout, clearTimer: typeof clearTimeout = clearTimeout): () => void {
  let alive = true
  const { sessionKey } = useAuthStore.getState()
  const isCurrentSession = () => {
    const auth = useAuthStore.getState()
    return auth.user?.id === userId && auth.sessionKey === sessionKey
  }
  /** 카테고리 이름 → 서버 번호, 항목 버튼 화면 번호 → 서버 번호 */
  const categoryIds = new Map<string, string>()
  const presetIds = new Map<string, string>()
  /** 카테고리 · 항목 버튼 요청 줄 (차례대로). 일정은 이 줄이 빌 때까지 기다렸다가 보냄 */
  let queue: Promise<void> = Promise.resolve()
  const enqueue = (work: () => Promise<void>) => {
    queue = queue.then(work, work).catch(() => {})
    return queue
  }
  /** 줄에 서 있는 카테고리 · 항목 동작 수 (받아 온 서버 값이 아직 안 간 내 변경을 덮지 않게) */
  let pendingOps = 0

  const catsSyncedKey = `zip-calendar-categories-synced:${userId}`

  /** 서버 카테고리 · 항목 버튼을 받아 화면에 넣음. 서버와 맞춘 적 없는 브라우저면 직접 만든 것을 먼저 올림 */
  const pullCategories = async (attempt = 0): Promise<void> => {
    if (!alive || !isCurrentSession()) return
    try {
      let [cats, presets] = await Promise.all([apiClient.get<ServerCategory[]>('/event-categories'), apiClient.get<ServerPreset[]>('/event-presets')])
      if (!alive || !isCurrentSession()) return
      if (syncStorage.read(catsSyncedKey) !== '1') {
        const local = useLifeStore.getState()
        const known = new Set(cats.data.map((c) => c.name))
        for (const c of local.categories) {
          if (!alive || !isCurrentSession()) return
          if (c.name !== UNCATEGORIZED && !known.has(c.name)) await apiClient.post('/event-categories', { name: c.name }).catch(() => {})
        }
        for (const p of local.customPresets) {
          if (!alive || !isCurrentSession()) return
          await apiClient.post('/event-presets', { title: p.title, category: p.category }).catch(() => {})
        }
        if (!alive || !isCurrentSession()) return
        syncStorage.write(catsSyncedKey, '1')
        ;[cats, presets] = await Promise.all([apiClient.get<ServerCategory[]>('/event-categories'), apiClient.get<ServerPreset[]>('/event-presets')])
        if (!alive || !isCurrentSession()) return
      }
      categoryIds.clear()
      for (const c of cats.data) categoryIds.set(c.name, c.id)
      if (pendingOps > 0) {
        // 받는 동안 새 동작이 줄에 섰음 → 화면은 그대로 두고 그 동작들이 끝난 뒤 다시 받음
        void enqueue(() => pullCategories())
        return
      }
      presetIds.clear()
      const categories: EventCategory[] = cats.data.map((c) => ({ name: c.name, ico: c.ico, items: c.items }))
      const customPresets: CustomPreset[] = presets.data.map((p) => ({ id: p.id, title: p.title, category: p.category }))
      useLifeStore.setState({ categories, customPresets })
    } catch {
      // 못 받으면 조금 뒤 다시 (그동안은 이 기기 값으로 보여 줌)
      if (alive && attempt < RETRY_DELAYS.length) {
        await new Promise((resolve) => setTimer(resolve, RETRY_DELAYS[attempt]))
        return pullCategories(attempt + 1)
      }
    }
  }

  /** 카테고리 · 항목 버튼 동작 하나를 서버에. 거절되면 서버 값을 다시 받고, 못 닿으면 조금 뒤 다시 */
  const send = (op: CategoryOp) => {
    pendingOps++
    return enqueue(async () => {
      try {
        await sendWithRetry(op)
      } finally {
        pendingOps--
      }
    })
  }
  const sendWithRetry = async (op: CategoryOp) => {
      for (let attempt = 0; alive && isCurrentSession(); attempt++) {
        try {
          await sendOnce(op)
          if (op.type === 'renameCategory' || op.type === 'deleteCategory') events.schedulePull(0) // 서버가 그 일정도 옮김
          return
        } catch (error) {
          const status = (error as { response?: { status?: number } }).response?.status
          if (rejected(error) || status === 401 || attempt >= RETRY_DELAYS.length - 1) {
            if (status !== 401) {
              await pullCategories()
              events.schedulePull(0)
            }
            return
          }
          await new Promise((resolve) => setTimer(resolve, RETRY_DELAYS[attempt]))
        }
      }
  }

  const categoryId = async (name: string) => {
    if (!categoryIds.has(name)) await pullCategories()
    if (!alive || !isCurrentSession()) throw new Error('로그인 상태가 변경됐어요.')
    const id = categoryIds.get(name)
    if (!id) throw Object.assign(new Error('no category'), { response: { status: 404 } })
    return id
  }
  const presetId = (id: string) => presetIds.get(id) ?? id

  async function sendOnce(op: CategoryOp) {
    switch (op.type) {
      case 'addCategory': {
        try {
          const { data } = await apiClient.post<ServerCategory>('/event-categories', { name: op.name })
          categoryIds.set(data.name, data.id)
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status !== 409) throw error // 이미 있으면 그대로
        }
        return
      }
      case 'renameCategory': {
        const id = await categoryId(op.from)
        await apiClient.patch(`/event-categories/${id}`, { name: op.to })
        categoryIds.delete(op.from)
        categoryIds.set(op.to, id)
        return
      }
      case 'deleteCategory': {
        const id = await categoryId(op.name)
        await apiClient.delete(`/event-categories/${id}`)
        categoryIds.delete(op.name)
        return
      }
      case 'addPreset': {
        const { data } = await apiClient.post<ServerPreset>('/event-presets', { title: op.title, category: op.category })
        presetIds.set(op.id, data.id)
        return
      }
      case 'updatePreset':
        await apiClient.patch(`/event-presets/${presetId(op.id)}`, { title: op.title, category: op.category })
        return
      case 'removePreset':
        try {
          await apiClient.delete(`/event-presets/${presetId(op.id)}`)
        } catch (error) {
          if ((error as { response?: { status?: number } }).response?.status !== 404) throw error // 이미 없으면 지운 것과 같음
        }
    }
  }

  const events = startListSync<CalEvent, null>({
    name: 'zip-events',
    userId,
    read: () => useLifeStore.getState().events,
    write: (list) => useLifeStore.setState({ events: list }),
    subscribe: (listener) => useLifeStore.subscribe((now, before) => now.events !== before.events && listener(now.events, before.events)),
    fetch: async () => ({ items: (await apiClient.get<ServerEvent[]>('/events')).data.map(toEvent), extra: null }),
    create: async (e) => Number((await apiClient.post<ServerEvent>('/events', fields(e))).data.id),
    update: (sid, e) => apiClient.patch(`/events/${sid}`, fields(e)),
    onRejectedSave: eventRecovery.record,
    remove: (sid) => apiClient.delete(`/events/${sid}`),
    waitFor: () => queue, // 카테고리 저장이 먼저
    isMuted: () => externalChange.mute || calendarHooks.quiet || !isCurrentSession(),
    isCurrentSession,
    setTimer,
    clearTimer,
  })
  retryEventSave = events.retrySave

  void enqueue(() => pullCategories())
  calendarHooks.onOp = (op) => {
    if (externalChange.mute || !isCurrentSession()) return
    void send(op)
  }
  const onHide = () => document.visibilityState === 'hidden' && events.flush()
  const onFocus = () => {
    void enqueue(() => pullCategories())
    events.schedulePull(0)
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide)
  if (typeof window !== 'undefined') window.addEventListener('focus', onFocus)
  externalChange.after = () => {
    // 이 기기 기록만 지운 것: 남은 일을 잊고 서버 값을 다시 받음
    events.forgetPending()
    void enqueue(() => pullCategories())
    events.schedulePull(0)
  }

  return () => {
    events.stop()
    alive = false
    if (retryEventSave === events.retrySave) retryEventSave = null
    if (calendarHooks.onOp) calendarHooks.onOp = null
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide)
    if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus)
    if (externalChange.after) externalChange = { mute: false, after: null }
  }
}

/** 서버 모드일 때 일정 · 카테고리 · 항목 버튼을 서버와 맞춤. 앱 화면 틀(AppLayout) 한 곳에서만 부르세요 */
export function useCalendarServerSync() {
  const userId = useAuthStore((s) => s.user?.id)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  useEffect(() => {
    if (isMockApi || !userId || !sessionKey) return
    return startCalendarSync(userId)
  }, [userId, sessionKey])
}
