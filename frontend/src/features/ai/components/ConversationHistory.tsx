import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button, Modal } from '@/components/ui'
import { isMockApi } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store/authStore'
import { getErrorMessage } from '@/lib/apiClient'
import { deleteConversation, listConversations, type ConversationSummary } from '../api'
import { useChatStore } from '../store'
import styles from './ConversationHistory.module.css'

const ENTRY: Record<ConversationSummary['entryPoint'], string> = { HOME_MODAL: '홈', AI_PAGE: 'AI 화면' }

/** "11월 28일 14:05" (올해가 아니면 연도도) */
function conversationDate(iso: string, now = new Date()) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  const day = `${at.getMonth() + 1}월 ${at.getDate()}일`
  return at.getFullYear() === now.getFullYear() ? `${day} ${time}` : `${at.getFullYear()}년 ${day} ${time}`
}

/**
 * 내 정보 › AI 대화 기록: 대화를 골라서 한 건씩 지움 (전체 삭제는 "데이터 초기화").
 * 지운 대화가 홈 "AI와 대화" 창에 열려 있던 대화면 그 창도 비워서, 다음에 열 때 지운 대화를 다시 보여 주지 않음.
 * 다른 기기에서 먼저 지워 404 가 오면 목록에서만 빼고 안내함.
 */
export function ConversationHistoryDialog({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted?: () => void }) {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const queryClient = useQueryClient()
  const key = ['ai', 'conversations', userId]
  const list = useQuery({ queryKey: key, queryFn: listConversations, enabled: open && !isMockApi && !!userId })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  const removeFromList = (id: string) => {
    queryClient.setQueryData<ConversationSummary[]>(key, (rows) => (rows ?? []).filter((c) => c.id !== id))
    if (useChatStore.getState().conversationId === id) useChatStore.getState().reset()
  }
  const remove = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_, id) => {
      removeFromList(id)
      setConfirmId(null)
      setNotice('대화를 지웠어요.')
      onDeleted?.()
    },
    onError: (error, id) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        removeFromList(id)
        setConfirmId(null)
        setNotice('이미 지워진 대화예요. 목록에서 뺐어요.')
      }
    },
  })

  const close = () => {
    setConfirmId(null)
    setNotice('')
    remove.reset()
    onClose()
  }

  const rows = list.data ?? []
  const otherError = remove.isError && !(axios.isAxiosError(remove.error) && remove.error.response?.status === 404)

  return (
    <Modal open={open} onClose={close} title="AI 대화 기록">
      <div className={styles.wrap}>
        <h3 className={styles.title}>AI 대화 기록</h3>
        <p className={styles.lead}>지우고 싶은 대화만 골라서 지울 수 있어요. 모두 지우려면 아래 ‘데이터 초기화’를 써요.</p>
        {isMockApi ? (
          <p className={styles.empty}>가짜 API 모드에서는 대화가 이 기기에만 저장돼요. ‘데이터 초기화’로 지울 수 있어요.</p>
        ) : list.isLoading ? (
          <p className={styles.empty}>불러오는 중…</p>
        ) : list.isError ? (
          <div className={styles.empty}>
            <p>대화 기록을 불러오지 못했어요.</p>
            <Button variant="line" className={styles.small} onClick={() => list.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>저장된 AI 대화가 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {rows.map((c) => (
              <li key={c.id} className={styles.item}>
                <div className={styles.text}>
                  <strong className={c.title ? undefined : styles.untitled}>{c.title || '아직 질문이 없는 대화'}</strong>
                  <small>
                    {ENTRY[c.entryPoint] ?? ''} · {conversationDate(c.updatedAt)}
                  </small>
                </div>
                {confirmId === c.id ? (
                  <div className={styles.confirm} role="group" aria-label="대화 삭제 확인">
                    <span>지울까요?</span>
                    <Button variant="line" className={styles.small} onClick={() => setConfirmId(null)} disabled={remove.isPending}>
                      취소
                    </Button>
                    <Button variant="danger" className={styles.small} loading={remove.isPending} onClick={() => remove.mutate(c.id)}>
                      지우기
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" className={styles.small} onClick={() => { setNotice(''); remove.reset(); setConfirmId(c.id) }} aria-label={`${c.title || '질문 없는 대화'} 지우기`}>
                    삭제
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {otherError && <p className={styles.error} role="alert">{getErrorMessage(remove.error)}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
      </div>
    </Modal>
  )
}
