import { useState } from 'react'
import { cx } from '@/lib/cx'
import { isMockApi } from '@/features/auth/api'
import type { ConversationSummary } from '../api'
import { groupConversations } from '../conversationGroups'
import styles from './ConversationSidebar.module.css'

type Props = {
  rows: ConversationSummary[]
  loading: boolean
  error: boolean
  activeId: string | null
  /** 지우는 중인 대화 id */
  deletingId: string | null
  notice: string
  onRetry: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  /** PC: 목록 접기 · 모바일: 서랍 닫기 */
  onClose: () => void
  closeLabel: string
}

/**
 * AI 화면 왼쪽 대화 목록 (GPT · Claude 처럼): 새 대화 · 날짜별 대화 · 대화마다 삭제(그 자리에서 "지울까요?" 확인).
 * 대화를 누르면 그 대화를 불러와 이어서 물어볼 수 있어요. 홈 "AI와 대화"에서 한 대화도 함께 보여요.
 */
export function ConversationSidebar({ rows, loading, error, activeId, deletingId, notice, onRetry, onNew, onSelect, onDelete, onClose, closeLabel }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const groups = groupConversations(rows)

  return (
    <nav className={styles.side} aria-label="AI 대화 목록">
      <div className={styles.top}>
        <b className={styles.brand}>AI 도우미</b>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={closeLabel} title={closeLabel}>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
            <path d="M9.5 4.5v15" />
          </svg>
        </button>
      </div>

      <button type="button" className={styles.newChat} onClick={onNew}>
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
          <path d="M12 20h8" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
        새 대화
      </button>

      <div className={styles.scroll}>
        {isMockApi ? (
          <p className={styles.empty}>가짜 API 모드에서는 대화 목록을 저장하지 않아요.</p>
        ) : loading ? (
          <p className={styles.empty}>불러오는 중…</p>
        ) : error ? (
          <p className={styles.empty}>
            대화 목록을 불러오지 못했어요.{' '}
            <button type="button" className={styles.retry} onClick={onRetry}>
              다시 시도
            </button>
          </p>
        ) : groups.length === 0 ? (
          <p className={styles.empty}>아직 대화가 없어요. 궁금한 걸 물어보면 여기에 쌓여요.</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className={styles.group}>
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((c) => {
                  const title = c.title || '새 대화'
                  return (
                    <li key={c.id} className={cx(styles.item, c.id === activeId && styles.active)}>
                      {confirmId === c.id ? (
                        <div className={styles.confirm} role="group" aria-label="대화 삭제 확인">
                          <span>지울까요?</span>
                          <button type="button" onClick={() => setConfirmId(null)} disabled={deletingId === c.id}>
                            취소
                          </button>
                          <button type="button" className={styles.danger} onClick={() => { onDelete(c.id); setConfirmId(null) }} disabled={deletingId === c.id}>
                            {deletingId === c.id ? '지우는 중' : '지우기'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <button type="button" className={styles.pick} onClick={() => onSelect(c.id)} aria-current={c.id === activeId ? 'true' : undefined} title={title}>
                            <span className={c.title ? undefined : styles.untitled}>{title}</span>
                          </button>
                          <button type="button" className={styles.remove} onClick={() => setConfirmId(c.id)} aria-label={`${title} 지우기`} title="지우기">
                            <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                            </svg>
                          </button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </nav>
  )
}
