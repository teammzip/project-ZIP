import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { RETRY_DELAYS, SAVE_DELAY, startListSync, type SyncId } from '@/lib/listSync'
import { useMemoStore } from './store'
import type { Memo, MemoItem } from './types'

/* 서버 모드 메모 동기화 (frontend/API.md 12장). 화면은 지금처럼 useMemoStore 를 쓰고, 메모 목록은 공통 엔진(lib/listSync)이 서버와 맞춰요.
 * 여기서는 메모만의 것: 서버 모양 ↔ 화면 모양, 홈 메모 순서(새 메모가 서버 번호를 받은 뒤 서버 번호로 저장). */

type ServerMemo = Omit<Memo, 'id' | 'createdAt' | 'updatedAt'> & { id: string; items: MemoItem[]; createdAt: string; updatedAt: string }

const toMemo = (m: ServerMemo): Memo => ({
  id: Number(m.id),
  title: m.title,
  ledgerContext: m.ledgerContext,
  draft: m.draft,
  folderId: m.folderId,
  body: m.body,
  color: m.color,
  pinned: m.pinned,
  checklist: m.checklist,
  items: m.items,
  createdAt: Date.parse(m.createdAt),
  updatedAt: Date.parse(m.updatedAt),
})

const fields = (m: Memo) => ({ title: m.title, body: m.body, color: m.color, pinned: m.pinned, checklist: m.checklist, items: m.items, folderId: m.folderId ?? '' })

/** 화면에서 "이 기기 기록 초기화"처럼 서버에 보내면 안 되는 변경: 보내지 않고, 끝나면 서버 값을 다시 받음 */
let externalChange: { mute: boolean; after: (() => void) | null } = { mute: false, after: null }
let settleWrites: (() => Promise<void>) | null = null
let saveLedgerMemo: ((id: number) => Promise<Memo>) | null = null
const missingMemo = '저장할 메모를 찾을 수 없어요. 메모를 다시 열어 주세요.'

export async function completeLedgerMemo(id: number): Promise<Memo> {
  if (!isMockApi) {
    if (!saveLedgerMemo) throw new Error('메모 동기화가 준비되면 다시 저장해 주세요.')
    return saveLedgerMemo(id)
  }
  const memo = useMemoStore.getState().memos.find((entry) => entry.id === id)
  if (!memo) throw new Error(missingMemo)
  const saved = { ...memo, draft: false, updatedAt: Date.now() }
  useMemoStore.setState((state) => ({ memos: state.memos.map((entry) => entry.id === id ? saved : entry) }))
  return saved
}

export async function settleMemoWrites() { await settleWrites?.() }
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
  let homeDirty = false
  let homeTimer: ReturnType<typeof setTimeout> | null = null
  let writing = false
  const memos = startListSync<Memo, { ids: string[] | null }>({
    name: 'zip-memos',
    userId,
    read: () => useMemoStore.getState().memos,
    write: (list, home, localOf) => {
      writing = true
      try {
        const homeIds = homeDirty ? useMemoStore.getState().homeIds : home.ids ? home.ids.map((s) => Number(localOf(Number(s)))) : null
        useMemoStore.setState({ memos: list, homeIds })
      } finally {
        writing = false
      }
      if (homeDirty) saveHomeLater()
    },
    subscribe: (listener) => useMemoStore.subscribe((now, before) => now.memos !== before.memos && listener(now.memos, before.memos)),
    fetch: async () => {
      const [list, home] = await Promise.all([apiClient.get<ServerMemo[]>('/memos'), apiClient.get<{ ids: string[] | null }>('/me/home-memos')])
      return { items: list.data.map(toMemo), extra: home.data }
    },
    create: async (m) => Number((await apiClient.post<ServerMemo>('/memos', fields(m))).data.id),
    update: (sid, m) => apiClient.patch(`/memos/${sid}`, fields(m)),
    keepRejectedUpdate: (memo) => !!memo.ledgerContext,
    remove: (sid) => apiClient.delete(`/memos/${sid}`),
    // 다른 회원으로 바뀌는 중에 저장소가 그 회원 사본으로 바뀌어도 보내지 않음
    isMuted: () => externalChange.mute || useAuthStore.getState().user?.id !== userId,
    setTimer,
    clearTimer,
  })

  const completions = new Map<number, Promise<Memo>>()
  const complete = (id: number): Promise<Memo> => {
    const pending = completions.get(id)
    if (pending) return pending
    const { sessionKey } = useAuthStore.getState()
    const checkSession = () => {
      const auth = useAuthStore.getState()
      if (!sessionKey || auth.sessionKey !== sessionKey || auth.user?.id !== userId) throw new Error('로그인 상태가 변경됐어요. 메모를 다시 열어 주세요.')
    }
    const request = memos.saveNow(id, async (serverId, memo) => {
      checkSession()
      const { data } = await apiClient.patch<ServerMemo>(`/memos/${serverId}`, { ...fields(memo), complete: true })
      checkSession()
      if (data.draft !== false) throw new Error('메모 확정을 확인하지 못했어요. 다시 저장해 주세요.')
      return { ...toMemo(data), id }
    }, (saved, unchanged) => {
      useMemoStore.setState((state) => ({
        memos: state.memos.map((memo) => memo.id === id ? (unchanged ? saved : { ...memo, draft: false }) : memo),
      }))
    }, missingMemo).finally(() => completions.delete(id))
    completions.set(id, request)
    return request
  }
  saveLedgerMemo = complete

  const settle = async () => {
    memos.flush()
    await Promise.all(useMemoStore.getState().memos.map((memo) => memos.settled(memo.id)))
  }
  settleWrites = settle

  const saveHome = async () => {
    homeTimer = null
    const ids = useMemoStore.getState().homeIds
    await Promise.all((ids ?? []).map((id) => memos.settled(id)))
    if (ids?.some((id) => memos.isNew(id))) return memos.schedulePull(RETRY_DELAYS[0]) // 아직 서버에 없는 메모가 있으면 나중에
    try {
      await apiClient.put('/me/home-memos', { ids: ids ? ids.map((id: SyncId) => String(memos.serverId(id))) : null })
      if (useMemoStore.getState().homeIds === ids) homeDirty = false
    } catch (error) {
      memos.failed(error, () => (homeDirty = false))
    }
  }
  function saveHomeLater() {
    if (homeTimer) clearTimer(homeTimer)
    homeTimer = setTimer(() => void saveHome(), SAVE_DELAY)
  }
  const unsubscribeHome = useMemoStore.subscribe((now, before) => {
    if (writing || externalChange.mute || now.homeIds === before.homeIds || useAuthStore.getState().user?.id !== userId) return
    homeDirty = true
    if (memos.ready()) saveHomeLater()
  })

  const flush = () => {
    memos.flush()
    if (homeTimer && memos.ready()) {
      clearTimer(homeTimer)
      void saveHome()
    }
  }
  const onHide = () => document.visibilityState === 'hidden' && flush()
  const onRefresh = () => memos.schedulePull(0)
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onRefresh)
    window.addEventListener('zip-memos-refresh', onRefresh)
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide)
  externalChange.after = () => {
    // 이 기기 기록만 지운 것: 남은 일을 잊고 서버 값을 다시 받음
    memos.forgetPending()
    homeDirty = false
    memos.schedulePull(0)
  }

  return () => {
    flush()
    memos.stop()
    if (settleWrites === settle) settleWrites = null
    if (saveLedgerMemo === complete) saveLedgerMemo = null
    unsubscribeHome()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide)
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('zip-memos-refresh', onRefresh)
    }
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
