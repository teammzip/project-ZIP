/* 목록 하나(메모 · 일정 …)를 서버와 맞추는 공통 엔진. 화면은 지금처럼 zustand 저장소를 쓰고, 이 엔진이 바뀐 것을 서버에 보내요.
 *
 * - 바뀐 것을 "아직 서버에 안 간 일"로 적어 두고(새 항목 · 고친 항목 · 지운 항목) 서버가 받았을 때만 지워요.
 *   그래서 처음 불러오기 전이나 다시 불러올 때도, 서버 값 위에 아직 안 간 내 변경을 다시 얹어서 잃지 않아요.
 * - 새 항목은 화면 번호(임시)와 서버 번호가 달라서 짝을 기억하고, 항목 하나에 대한 요청은 차례대로 하나씩 보내요(늦게 간 옛 내용이 덮어쓰지 않게).
 * - 서버에 못 닿으면(네트워크 · 5xx) 조금씩 간격을 늘려 다시 불러오고 다시 보내요. 서버가 거절하면(4xx) 그 일은 버리고 서버 값을 따라요.
 * - 서버와 한 번도 맞춘 적 없는 브라우저의 항목(서버 연결 전에 쓴 것)은 하나씩 올리고, 올린 것을 기억해서 중간에 끊겨도 이어서 올려요.
 *   한 번 다 맞춘 브라우저의 사본은 다시 올리지 않아요(다른 기기에서 지운 항목이 되살아나지 않게). */

export type SyncId = number | string

export type ListSyncOptions<T extends { id: SyncId }, Extra> = {
  /** 이 브라우저가 서버와 맞췄는지 적어 두는 이름 (예: 'zip-memos' → zip-memos-synced:<회원>) */
  name: string
  userId: string
  read: () => T[]
  /** 서버 값에 내 변경을 얹은 목록을 넣음 (이때 바뀐 것은 다시 보내지 않음). localOf: 서버 번호 → 화면 번호 */
  write: (list: T[], extra: Extra, localOf: (serverId: SyncId) => SyncId) => void
  /** 목록이 바뀔 때마다 불러 줄 함수를 등록 → 등록 해제 함수 */
  subscribe: (listener: (now: T[], before: T[]) => void) => () => void
  /** 서버 값 (항목의 id 는 서버 번호) + 같이 받을 값 */
  fetch: () => Promise<{ items: T[]; extra: Extra }>
  create: (item: T) => Promise<SyncId>
  update: (serverId: SyncId, item: T) => Promise<unknown>
  keepRejectedUpdate?: (item: T) => boolean
  remove: (serverId: SyncId) => Promise<unknown>
  /** 보내기 전에 기다릴 일 (예: 일정은 카테고리 저장이 끝난 뒤에) */
  waitFor?: () => Promise<unknown>
  /** true 면 지금 바뀐 것은 서버에 보내지 않음 (예: 이 기기 기록 초기화) */
  isMuted?: () => boolean
  setTimer?: typeof setTimeout
  clearTimer?: typeof clearTimeout
}

export type ListSync<T> = {
  stop: () => void
  /** 서버 값을 한 번이라도 받았는지 */
  ready: () => boolean
  serverId: (id: SyncId) => SyncId
  /** 아직 서버에 없는 항목인지 */
  isNew: (id: SyncId) => boolean
  /** 이 항목에 대한 요청이 다 끝날 때까지 */
  settled: (id: SyncId) => Promise<void>
  /** 자동 저장과 같은 순서로 명시적인 저장을 실행하고 성공 응답을 적용 */
  saveNow: (id: SyncId, write: (serverId: SyncId, item: T) => Promise<T>, apply: (saved: T, unchanged: boolean) => void, missing: string) => Promise<T>
  schedulePull: (delay: number) => void
  /** 같이 보내는 다른 값이 실패했을 때: 거절이면 drop, 아니면 나중에 다시 */
  failed: (error: unknown, drop: () => void) => void
  /** 기다리던 저장을 지금 바로 */
  flush: () => void
  /** 아직 안 간 일을 모두 잊음 (이 기기 기록만 지웠을 때) */
  forgetPending: () => void
}

export const SAVE_DELAY = 500
export const RETRY_DELAYS = [2_000, 5_000, 15_000, 30_000, 60_000]

/** 4xx(로그인 만료 · 너무 많은 요청 제외) = 서버가 거절함 → 그 일은 버림. 나머지(네트워크 · 5xx)는 다시 시도 */
export const rejected = (error: unknown) => {
  const status = (error as { response?: { status?: number } }).response?.status
  return !!status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429
}

export const syncStorage = {
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

export function startListSync<T extends { id: SyncId }, Extra>(o: ListSyncOptions<T, Extra>): ListSync<T> {
  const setTimer = o.setTimer ?? setTimeout
  const clearTimer = o.clearTimer ?? clearTimeout
  let alive = true
  let ready = false // 서버 값을 한 번 받기 전에는 보내지 않고 적어만 둠
  let muted = false
  const created = new Map<SyncId, SyncId>() // 화면 번호 → 서버 번호 (새로 만든 항목)
  const createdAt = new Map<SyncId, number>() // 서버에 만들어진 시각 (불러오기 중에 만들어진 항목을 지키려고)
  const newIds = new Set<SyncId>() // 아직 서버에 없는 항목 (만들 차례)
  const dirty = new Set<SyncId>() // 고쳤는데 아직 서버가 받지 않은 항목
  const removed = new Set<SyncId>() // 지웠는데 아직 서버에서 안 지운 항목
  const chains = new Map<SyncId, Promise<void>>() // 항목마다 요청을 차례로
  const explicitWrites = new Set<SyncId>()
  let writeVersion = 0
  const timers = new Map<SyncId, ReturnType<typeof setTimeout>>()
  let pullTimer: ReturnType<typeof setTimeout> | null = null
  let failures = 0

  const syncedKey = `${o.name}-synced:${o.userId}`
  const movedKey = `${o.name}-moved:${o.userId}`
  const isSynced = () => syncStorage.read(syncedKey) === '1'
  const moved = () => {
    try {
      return new Set<SyncId>(JSON.parse(syncStorage.read(movedKey) ?? '[]'))
    } catch {
      return new Set<SyncId>()
    }
  }
  const markMoved = (id: SyncId) => syncStorage.write(movedKey, JSON.stringify([...moved(), id]))
  const finishMoving = () => {
    if (isSynced() || newIds.size) return
    syncStorage.write(syncedKey, '1')
    syncStorage.write(movedKey, null)
  }

  const current = (id: SyncId) => o.read().find((m) => m.id === id)
  const serverId = (id: SyncId) => created.get(id) ?? id
  const waitFor = () => (o.waitFor ? o.waitFor().catch(() => {}) : Promise.resolve())

  const schedulePull = (delay: number) => {
    if (!alive || pullTimer) return
    pullTimer = setTimer(() => {
      pullTimer = null
      void pull()
    }, delay)
  }
  const failed = (error: unknown, drop: () => void) => {
    if (rejected(error)) {
      drop()
      schedulePull(0)
    } else schedulePull(RETRY_DELAYS[Math.min(failures++, RETRY_DELAYS.length - 1)])
  }

  const enqueue = <Result>(id: SyncId, work: () => Promise<Result>): Promise<Result> => {
    const next = (chains.get(id) ?? Promise.resolve()).then(work, work)
    const tail = next.then(() => {}, () => {})
    chains.set(id, tail)
    void tail.then(() => { if (chains.get(id) === tail) chains.delete(id) })
    return next
  }

  const create = (id: SyncId) =>
    enqueue(id, async () => {
      if (!newIds.has(id)) return
      await waitFor()
      const item = current(id)
      if (!item) {
        newIds.delete(id)
        return
      }
      try {
        const sid = await o.create(item)
        created.set(id, sid)
        createdAt.set(id, Date.now())
        newIds.delete(id)
        failures = 0
        if (!isSynced()) markMoved(id)
        if (current(id) === item) dirty.delete(id)
        else dirty.add(id)
        finishMoving()
      } catch (error) {
        failed(error, () => {
          // 서버가 받지 않는 항목(예: 너무 긺)은 다시 올리지 않음 — 계속 다시 보내는 것을 막음
          newIds.delete(id)
          if (!isSynced()) markMoved(id)
          finishMoving()
        })
      }
    })

  const save = (id: SyncId) => {
    const t = timers.get(id)
    if (t) clearTimer(t)
    timers.delete(id)
    enqueue(id, async () => {
      if (!dirty.has(id) || newIds.has(id) || removed.has(id)) return
      await waitFor()
      const item = current(id)
      if (!item) return
      try {
        await o.update(serverId(id), item)
        failures = 0
        if (current(id) === item) dirty.delete(id)
      } catch (error) {
        if (rejected(error) && o.keepRejectedUpdate?.(item)) return
        failed(error, () => dirty.delete(id))
      }
    })
  }
  const saveLater = (id: SyncId) => {
    const t = timers.get(id)
    if (t) clearTimer(t)
    timers.set(id, setTimer(() => save(id), SAVE_DELAY))
  }

  const remove = (id: SyncId) => {
    const t = timers.get(id)
    if (t) clearTimer(t)
    timers.delete(id)
    enqueue(id, async () => {
      if (!removed.has(id)) return
      try {
        await o.remove(serverId(id))
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status
        if (status !== 404) return failed(error, () => removed.delete(id)) // 404 = 이미 없음 → 지운 것과 같음
      }
      failures = 0
      removed.delete(id)
      dirty.delete(id)
    })
  }

  /** 서버 값을 받아 그 위에 아직 서버에 안 간 내 변경을 얹고, 남은 일을 보냄 */
  async function pull(): Promise<void> {
    const startedAt = Date.now()
    const version = writeVersion
    try {
      await waitFor()
      const { items, extra } = await o.fetch()
      if (!alive) return
      if (version !== writeVersion) return schedulePull(0)
      failures = 0
      const local = o.read()
      const localOf = new Map([...created].map(([l, s]) => [s, l]))
      const merged: T[] = []
      for (const m of items) {
        const id = localOf.get(m.id) ?? m.id
        if (removed.has(id)) continue
        const mine = dirty.has(id) || explicitWrites.has(id) ? local.find((x) => x.id === id) : undefined
        merged.push(mine ?? { ...m, id })
      }
      // 서버 값에 아직 없는 내 항목: 만들 차례인 것, 불러오는 동안 만들어진 것, 서버와 맞춘 적 없는 브라우저의 항목
      const synced = isSynced()
      const done = moved()
      for (const m of local) {
        if (merged.some((x) => x.id === m.id) || removed.has(m.id)) continue
        const justCreated = (createdAt.get(m.id) ?? 0) >= startedAt
        if (!newIds.has(m.id) && !justCreated && (synced || done.has(m.id) || created.has(m.id))) continue
        if (!justCreated) newIds.add(m.id)
        merged.push(m)
      }
      for (const id of dirty) if (!merged.some((m) => m.id === id)) dirty.delete(id) // 다른 기기에서 지운 항목
      muted = true
      try {
        o.write(merged, extra, (sid) => localOf.get(sid) ?? sid)
      } finally {
        muted = false
      }
      ready = true
      for (const id of newIds) create(id)
      for (const id of dirty) saveLater(id)
      for (const id of removed) remove(id)
      finishMoving()
    } catch {
      if (alive) schedulePull(RETRY_DELAYS[Math.min(failures++, RETRY_DELAYS.length - 1)])
    }
  }

  const unsubscribe = o.subscribe((now, before) => {
    if (muted || o.isMuted?.()) return
    const old = new Map(before.map((m) => [m.id, m]))
    const kept = new Set(now.map((m) => m.id))
    for (const m of now) {
      const was = old.get(m.id)
      if (!was) {
        newIds.add(m.id)
        if (ready) create(m.id)
      } else if (was !== m) {
        dirty.add(m.id)
        if (ready) saveLater(m.id)
      }
    }
    for (const m of before) {
      if (kept.has(m.id)) continue
      dirty.delete(m.id)
      if (newIds.has(m.id) && !chains.has(m.id)) newIds.delete(m.id) // 서버에 만든 적 없음 → 지울 것도 없음
      else {
        removed.add(m.id)
        if (ready) remove(m.id)
      }
    }
  })

  const flush = () => {
    if (!ready) return
    for (const id of [...timers.keys()]) save(id)
  }

  const saveNow: ListSync<T>['saveNow'] = (id, write, apply, missing) => {
    const timer = timers.get(id)
    if (timer) clearTimer(timer)
    timers.delete(id)
    explicitWrites.add(id)
    return enqueue(id, async () => {
      try {
        const item = current(id)
        if (!alive || o.isMuted?.() || !item || newIds.has(id) || removed.has(id)) throw new Error(missing)
        const saved = await write(serverId(id), item)
        if (!alive || o.isMuted?.() || !current(id) || removed.has(id)) throw new Error(missing)
        const unchanged = current(id) === item
        muted = true
        try {
          apply(saved, unchanged)
        } finally {
          muted = false
        }
        if (unchanged) dirty.delete(id)
        writeVersion++
        return saved
      } catch (error) {
        if (alive && !o.isMuted?.() && current(id) && !removed.has(id)) dirty.add(id)
        throw error
      } finally {
        explicitWrites.delete(id)
      }
    })
  }

  void pull()
  return {
    stop: () => {
      flush()
      alive = false
      unsubscribe()
      if (pullTimer) clearTimer(pullTimer)
    },
    ready: () => ready,
    serverId,
    isNew: (id) => newIds.has(id),
    settled: (id) => chains.get(id) ?? Promise.resolve(),
    saveNow,
    schedulePull,
    failed,
    flush,
    forgetPending: () => {
      newIds.clear()
      dirty.clear()
      removed.clear()
    },
  }
}
