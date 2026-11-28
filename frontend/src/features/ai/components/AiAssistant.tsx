import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAuthStore } from '@/features/auth'
import { isMockApi } from '@/features/auth/api'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { deleteConversation, listConversations, loadConversation, type ConversationSummary } from '../api'
import { useChatStore, type ChatMsg } from '../store'
import { AiChat } from './AiChat'
import { ConversationSidebar } from './ConversationSidebar'
import styles from './AiAssistant.module.css'

type Props = {
  region: string
  name: string
}

/** AI 도우미: 왼쪽 대화 목록(GPT · Claude 처럼) + 오른쪽 채팅. 회원 · 로그인이 바뀌면 통째로 새로 그림 */
export function AiAssistant(props: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  return <AiWorkspace key={`${userId}:${sessionKey}`} userId={userId ?? null} {...props} />
}

const COLLAPSE_KEY = 'zip-ai-sidebar-collapsed'
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}
const isNarrow = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches

type Session = { key: string; initial?: { id: string; msgs: ChatMsg[] } }

function AiWorkspace({ userId, ...props }: Props & { userId: string | null }) {
  const queryClient = useQueryClient()
  const listKey = ['ai', 'conversations', userId]
  const list = useQuery({ queryKey: listKey, queryFn: listConversations, enabled: !isMockApi && !!userId })
  const [session, setSession] = useState<Session>({ key: 'new' })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  // PC: 목록 접기(이 브라우저에 기억) · 모바일: 서랍처럼 열고 닫기
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawer, setDrawer] = useState(false)

  const setCollapsedSaved = (next: boolean) => {
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* 기억하지 못해도 지금 화면에는 적용 */
    }
  }
  const toggleList = () => (isNarrow() ? setDrawer((v) => !v) : setCollapsedSaved(!collapsed))
  const closeList = () => (isNarrow() ? setDrawer(false) : setCollapsedSaved(true))

  const removeFromList = (id: string) => {
    queryClient.setQueryData<ConversationSummary[]>(listKey, (rows) => (rows ?? []).filter((c) => c.id !== id))
    // 홈 "AI와 대화" 창에 열려 있던 대화면 그 창도 비움
    if (useChatStore.getState().conversationId === id) useChatStore.getState().reset()
    if (id === activeId) startNew()
  }

  const startNew = () => {
    setSession({ key: `new-${Date.now()}` })
    setActiveId(null)
    setDrawer(false)
  }

  const select = (id: string) => {
    setDrawer(false)
    if (id === activeId || loadingId) return
    setNotice('')
    setLoadingId(id)
    loadConversation(id)
      .then((msgs) => {
        setSession({ key: `${id}-${Date.now()}`, initial: { id, msgs } })
        setActiveId(id)
      })
      .catch((error) => {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          removeFromList(id)
          setNotice('이미 지워진 대화예요. 목록에서 뺐어요.')
        } else setNotice(`대화를 불러오지 못했어요. ${getErrorMessage(error)}`)
      })
      .finally(() => setLoadingId(null))
  }

  const remove = useMutation({
    mutationFn: deleteConversation,
    onMutate: () => setNotice(''),
    onSuccess: (_, id) => {
      removeFromList(id)
      setNotice('대화를 지웠어요.')
    },
    onError: (error, id) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        removeFromList(id)
        setNotice('이미 지워진 대화예요. 목록에서 뺐어요.')
      } else setNotice(`지우지 못했어요. ${getErrorMessage(error)}`)
    },
  })

  // 채팅에서 대화방이 생기거나 답을 받으면 목록을 새로 받아 제목 · 순서를 맞춤
  const onActivity = (id: string) => {
    setActiveId(id)
    void queryClient.invalidateQueries({ queryKey: listKey })
  }

  const sidebar = (closeLabel: string) => (
    <ConversationSidebar
      rows={list.data ?? []}
      loading={list.isLoading}
      error={list.isError}
      activeId={loadingId ?? activeId}
      deletingId={remove.isPending ? remove.variables ?? null : null}
      notice={notice}
      onRetry={() => void list.refetch()}
      onNew={startNew}
      onSelect={select}
      onDelete={(id) => remove.mutate(id)}
      onClose={closeList}
      closeLabel={closeLabel}
    />
  )

  return (
    <div className={cx(styles.workspace, collapsed && styles.collapsed)}>
      {!collapsed && <aside className={styles.sideCol}>{sidebar('대화 목록 접기')}</aside>}
      {drawer && (
        <>
          <div className={styles.backdrop} onClick={() => setDrawer(false)} />
          <aside className={styles.drawer}>{sidebar('대화 목록 닫기')}</aside>
        </>
      )}
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.toolBtn} onClick={toggleList} aria-label="대화 목록 열기" title="대화 목록">
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
              <path d="M9.5 4.5v15" />
            </svg>
          </button>
          <button type="button" className={styles.toolBtn} onClick={startNew} aria-label="새 대화" title="새 대화">
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
              <path d="M12 20h8" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
        </div>
        {loadingId ? (
          <p className={styles.loading} role="status">대화를 불러오는 중…</p>
        ) : (
          <AiChat key={session.key} {...props} className={styles.chat} initial={session.initial} onActivity={onActivity} />
        )}
      </div>
    </div>
  )
}
