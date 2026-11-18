import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { useMemoStore } from './store'
import type { Memo, MemoItem } from './types'

/* 서버 모드 메모 동기화 (frontend/API.md 12장). 화면은 지금처럼 useMemoStore 를 쓰고, 여기서 서버와 맞춰요.
 *
 * - 바뀐 것을 "아직 서버에 안 간 일"로 적어 두고(새 메모 · 고친 메모 · 지운 메모 · 홈 순서) 서버가 받았을 때만 지워요.
 *   그래서 처음 불러오기 전이나 다시 불러올 때도, 서버 값 위에 아직 안 간 내 변경을 다시 얹어서 잃지 않아요.
 * - 새 메모는 화면 번호(임시)와 서버 번호가 달라서 짝을 기억하고, 메모 하나에 대한 요청은 차례대로 하나씩 보내요(늦게 간 옛 내용이 덮어쓰지 않게).
 * - 서버에 못 닿으면(네트워크 · 5xx) 조금씩 간격을 늘려 다시 불러오고 다시 보내요. 서버가 거절하면(4xx) 그 일은 버리고 서버 값을 따라요.
 * - 서버와 한 번도 맞춘 적 없는 브라우저의 메모(서버 연결 전에 쓴 것)는 하나씩 올리고, 올린 것을 기억해서 중간에 끊겨도 이어서 올려요.
 *   한 번 다 맞춘 브라우저의 사본은 다시 올리지 않아요(다른 기기에서 지운 메모가 되살아나지 않게). */

type ServerMemo = Omit<Memo, 'id' | 'createdAt' | 'updatedAt'> & { id: string; items: MemoItem[]; createdAt: string; updatedAt: string }

const toMemo = (m: ServerMemo): Memo => ({
  id: Number(m.id),
  title: m.title,
  body: m.body,
  color: m.color,
  pinned: m.pinned,
  checklist: m.checklist,
  items: m.items,
  createdAt: Date.parse(m.createdAt),
  updatedAt: Date.parse(m.updatedAt),
})

const fields = (m: Memo) => ({ title: m.title, body: m.body, color: m.color, pinned: m.pinned, checklist: m.checklist, items: m.items })

export const SAVE_DELAY = 500
const RETRY_DELAYS = [2_000, 5_000, 15_000, 30_000, 60_000]

/** 4xx(로그인 만료 · 너무 많은 요청 제외) = 서버가 거절함 → 그 일은 버림. 나머지(네트워크 · 5xx)는 다시 시도 */
const rejected = (error: unknown) => {
  const status = (error as { response?: { status?: number } }).response?.status
  return !!status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429
}

const storage = {
  read: (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  write: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      // 저장할 수 없어도 동기화는 계속
    }
  },
}

/** 화면에서 "이 기기 기록 초기화"처럼 서버에 보내면 안 되는 변경: 보내지 않고, 끝나면 서버 값을 다시 받음 */
let externalChange: { mute: boolean; after: (() => void) | null } = { mute: false, after: null }
export function withoutMemoSync(apply: () => void) {
  externalChange.mute = true
  try {
    apply()
  } finally {
    externalChange.mute = false
  }
  externalChange.after?.()
}

/** 동기화 시작 → 멈추는 함수. useMemoServerSync 가 부르고, 테스트도 직접 불러요 */
export function startMemoSync(userId: string, setTimer: typeof setTimeout = setTimeout, clearTimer: typeof clearTimeout = clearTimeout): () => void {
  let alive = true
  let ready = false // 서버 값을 한 번 받기 전에는 보내지 않고 적어만 둠
  let muted = false
  const created = new Map<number, number>() // 화면 번호 → 서버 번호 (새로 만든 메모)
  const createdAt = new Map<number, number>() // 서버에 만들어진 시각 (불러오기 중에 만들어진 메모를 지키려고)
  const newIds = new Set<number>() // 아직 서버에 없는 메모 (만들 차례)
  const dirty = new Set<number>() // 고쳤는데 아직 서버가 받지 않은 메모
  const removed = new Set<number>() // 지웠는데 아직 서버에서 안 지운 메모
  let homeDirty = false
  const chains = new Map<number, Promise<void>>() // 메모마다 요청을 차례로
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  let homeTimer: ReturnType<typeof setTimeout> | null = null
  let pullTimer: ReturnType<typeof setTimeout> | null = null
  let failures = 0

  const syncedKey = `zip-memos-synced:${userId}`
  const movedKey = `zip-memos-moved:${userId}`
  const isSynced = () => storage.read(syncedKey) === '1'
  const moved = () => {
    try {
      return new Set<number>(JSON.parse(storage.read(movedKey) ?? '[]'))
    } catch {
      return new Set<number>()
    }
  }
  const markMoved = (id: number) => storage.write(movedKey, JSON.stringify([...moved(), id]))
  const finishMoving = () => {
    if (isSynced() || newIds.size) return
    storage.write(syncedKey, '1')
    storage.write(movedKey, null)
  }

  const current = (id: number) => useMemoStore.getState().memos.find((m) => m.id === id)
  const serverId = (id: number) => created.get(id) ?? id

  const schedulePull = (delay: number) => {
    if (!alive || pullTimer) return
    pullTimer = setTimer(() => {
      pullTimer = null
      void pull()
    }, delay)
  }
  /** 실패 처리: 거절이면 drop() 하고 서버 값을 따르고, 못 닿았으면 나중에 다시 */
  const failed = (error: unknown, drop: () => void) => {
    if (rejected(error)) {
      drop()
      schedulePull(0)
    } else schedulePull(RETRY_DELAYS[Math.min(failures++, RETRY_DELAYS.length - 1)])
  }

  const enqueue = (id: number, work: () => Promise<void>) => {
    const next = (chains.get(id) ?? Promise.resolve()).then(work, work)
    chains.set(id, next)
    void next.finally(() => chains.get(id) === next && chains.delete(id))
  }

  const create = (id: number) =>
    enqueue(id, async () => {
      if (!newIds.has(id)) return
      const memo = current(id)
      if (!memo) {
        newIds.delete(id)
        return
      }
      try {
        const { data } = await apiClient.post<ServerMemo>('/memos', fields(memo))
        created.set(id, Number(data.id))
        createdAt.set(id, Date.now())
        newIds.delete(id)
        failures = 0
        if (!isSynced()) markMoved(id)
        if (current(id) === memo) dirty.delete(id)
        else dirty.add(id)
        finishMoving()
      } catch (error) {
        failed(error, () => {
          // 서버가 받지 않는 메모(예: 너무 긺)는 다시 올리지 않음 — 계속 다시 보내는 것을 막음
          newIds.delete(id)
          if (!isSynced()) markMoved(id)
          finishMoving()
        })
      }
    })

  const save = (id: number) => {
    const t = timers.get(id)
    if (t) clearTimer(t)
    timers.delete(id)
    enqueue(id, async () => {
      if (!dirty.has(id) || newIds.has(id) || removed.has(id)) return
      const memo = current(id)
      if (!memo) return
      try {
        await apiClient.patch(`/memos/${serverId(id)}`, fields(memo))
        failures = 0
        if (current(id) === memo) dirty.delete(id)
      } catch (error) {
        failed(error, () => dirty.delete(id))
      }
    })
  }
  const saveLater = (id: number) => {
    const t = timers.get(id)
    if (t) clearTimer(t)
    timers.set(id, setTimer(() => save(id), SAVE_DELAY))
  }

  const remove = (id: number) => {
    const t = timers.get(id)
    if (t) clearTimer(t)
    timers.delete(id)
    enqueue(id, async () => {
      if (!removed.has(id)) return
      try {
        await apiClient.delete(`/memos/${serverId(id)}`)
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status
        if (status !== 404) return failed(error, () => removed.delete(id)) // 404 = 이미 없음 → 지운 것과 같음
      }
      failures = 0
      removed.delete(id)
      dirty.delete(id)
    })
  }

  const saveHome = async () => {
    homeTimer = null
    const ids = useMemoStore.getState().homeIds
    await Promise.all((ids ?? []).map((id) => chains.get(id)))
    if (ids?.some((id) => newIds.has(id))) return schedulePull(RETRY_DELAYS[0]) // 아직 서버에 없는 메모가 있으면 나중에
    try {
      await apiClient.put('/me/home-memos', { ids: ids ? ids.map((id) => String(serverId(id))) : null })
      failures = 0
      if (useMemoStore.getState().homeIds === ids) homeDirty = false
    } catch (error) {
      failed(error, () => (homeDirty = false))
    }
  }
  const saveHomeLater = () => {
    if (homeTimer) clearTimer(homeTimer)
    homeTimer = setTimer(() => void saveHome(), SAVE_DELAY)
  }

  /** 서버 값을 받아 그 위에 아직 서버에 안 간 내 변경을 얹고, 남은 일을 보냄 */
  async function pull(): Promise<void> {
    const startedAt = Date.now()
    try {
      const [memos, home] = await Promise.all([
        apiClient.get<ServerMemo[]>('/memos'),
        apiClient.get<{ ids: string[] | null }>('/me/home-memos'),
      ])
      if (!alive) return
      failures = 0
      const local = useMemoStore.getState()
      const localOf = new Map([...created].map(([l, s]) => [s, l]))
      const merged: Memo[] = []
      for (const m of memos.data.map(toMemo)) {
        const id = localOf.get(m.id) ?? m.id
        if (removed.has(id)) continue
        const mine = dirty.has(id) ? local.memos.find((x) => x.id === id) : undefined
        merged.push(mine ?? { ...m, id })
      }
      // 서버 값에 아직 없는 내 메모: 만들 차례인 것, 불러오는 동안 만들어진 것, 서버와 맞춘 적 없는 브라우저의 메모
      const synced = isSynced()
      const done = moved()
      for (const m of local.memos) {
        if (merged.some((x) => x.id === m.id) || removed.has(m.id)) continue
        const justCreated = (createdAt.get(m.id) ?? 0) >= startedAt
        if (!newIds.has(m.id) && !justCreated && (synced || done.has(m.id) || created.has(m.id))) continue
        if (!justCreated) newIds.add(m.id)
        merged.push(m)
      }
      for (const id of dirty) if (!merged.some((m) => m.id === id)) dirty.delete(id) // 다른 기기에서 지운 메모
      const homeIds = homeDirty ? local.homeIds : home.data.ids ? home.data.ids.map((s) => localOf.get(Number(s)) ?? Number(s)) : null
      muted = true
      useMemoStore.setState({ memos: merged, homeIds })
      muted = false
      ready = true
      for (const id of newIds) create(id)
      for (const id of dirty) saveLater(id)
      for (const id of removed) remove(id)
      if (homeDirty) saveHomeLater()
      finishMoving()
    } catch {
      if (alive) schedulePull(RETRY_DELAYS[Math.min(failures++, RETRY_DELAYS.length - 1)])
    }
  }

  const unsubscribe = useMemoStore.subscribe((now, before) => {
    if (muted || externalChange.mute) return
    if (now.memos !== before.memos) {
      const old = new Map(before.memos.map((m) => [m.id, m]))
      const kept = new Set(now.memos.map((m) => m.id))
      for (const m of now.memos) {
        const was = old.get(m.id)
        if (!was) {
          newIds.add(m.id)
          if (ready) create(m.id)
        } else if (was !== m) {
          dirty.add(m.id)
          if (ready) saveLater(m.id)
        }
      }
      for (const m of before.memos) {
        if (kept.has(m.id)) continue
        dirty.delete(m.id)
        if (newIds.has(m.id) && !chains.has(m.id)) newIds.delete(m.id) // 서버에 만든 적 없음 → 지울 것도 없음
        else {
          removed.add(m.id)
          if (ready) remove(m.id)
        }
      }
    }
    if (now.homeIds !== before.homeIds) {
      homeDirty = true
      if (ready) saveHomeLater()
    }
  })

  /** 기다리던 저장을 지금 바로 (화면을 닫거나 다른 회원이 될 때) */
  const flush = () => {
    if (!ready) return
    for (const id of [...timers.keys()]) save(id)
    if (homeTimer) {
      clearTimer(homeTimer)
      void saveHome()
    }
  }
  const onHide = () => document.visibilityState === 'hidden' && flush()
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide)
  externalChange.after = () => {
    // 이 기기 기록만 지운 것: 남은 일을 잊고 서버 값을 다시 받음
    newIds.clear()
    dirty.clear()
    removed.clear()
    homeDirty = false
    schedulePull(0)
  }

  void pull()
  return () => {
    flush()
    alive = false
    unsubscribe()
    if (pullTimer) clearTimer(pullTimer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide)
    if (externalChange.after) externalChange = { mute: false, after: null }
  }
}

/** 서버 모드일 때 메모를 서버와 맞춤. 앱 화면 틀(AppLayout) 한 곳에서만 부르세요 */
export function useMemoServerSync() {
  const userId = useAuthStore((s) => s.user?.id)
  useEffect(() => {
    if (isMockApi || !userId) return
    return startMemoSync(userId)
  }, [userId])
}
