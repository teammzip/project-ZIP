import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { loadMonthlyBudget } from '@/features/life'
import { useAuthStore } from '@/features/auth/store/authStore'
import { askAi, createConversation, loadLatestConversation, recordExchange } from '../api'
import { useChatStore, type ChatMsg } from '../store'
import { BUDGET_LOAD_ERROR, SUMMARY_ASK, chatMessageText, chatReply, getTopicSuggestion, topicById, usesAiReply, type AiContext, type Topic } from '../topics'
import { BudgetSummaryCard } from './BudgetSummaryCard'
import styles from './Ai.module.css'
import { SelectedTopicChip, SuggestedTopicChip, TopicPicker } from './TopicPicker'
import { BillPhotoQuestion } from './BillPhotoQuestion'
import { UsageGuide } from './UsageGuide'
import { NearbySearch } from './NearbySearch'
import { NEARBY_PROMPT } from '../nearbySearch'
import guideStyles from './UsageGuide.module.css'

/** 홈에서 선택한 주제 또는 제출한 메시지 */
export type ChatOpening = { text: string } | { topic: string } | null

type Props = {
  open: boolean
  onClose: () => void
  opening: ChatOpening
  ctx: Omit<AiContext, 'hasPhoto'>
}

/** 홈 "AI와 대화" 모달. 대화는 서버 DB(ai_conversations · ai_messages)에 저장돼서 다시 열면 이어짐 (서버를 안 쓰면 이 브라우저에만). 자유 질문은 서버의 AI(Gemini)가 답하고, AI 를 쓸 수 없으면 데모 답변 */
export function ChatModal({ open, onClose, opening, ctx }: Props) {
  const { push, reset, load, setConversationId, msgs } = useChatStore()
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [topic, setTopic] = useState<Topic | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const summarySelected = topic?.id === 'summary'
  const body = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const topicTrigger = useRef<HTMLButtonElement>(null)
  const sentOpening = useRef<ChatOpening>(null)

  /** 이 회원의 대화 중 가장 최근 것을 서버에서 한 번 불러옴 (서버를 안 쓰면 아무 일도 안 함) */
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const syncedFor = useRef<string | null>(null)
  const sync = useEffectEvent(async () => {
    if (!userId || syncedFor.current === userId) return
    syncedFor.current = userId
    const latest = await loadLatestConversation('HOME_MODAL')
    if (latest) load(latest.id, latest.msgs)
  })

  const send = (keyword: string, selected: Topic | null = null) => {
    const context = { ...ctx, hasPhoto: false }
    const v = chatMessageText(selected, keyword)
    const topicId = selected?.id
    if (!v || busy) return
    const redirect = getTopicSuggestion(selected, v)
    const isNearby = topicId === 'nearby'
    const isSummary = topicId === 'summary' || ((!selected || topicId === 'qna') && SUMMARY_ASK.test(v))
    const token = useAuthStore.getState().token
    setBusy(true)
    push({ role: 'user', text: v })
    if (redirect) push({ role: 'bot', ...redirect })
    else if (isNearby) push({ role: 'bot', text: NEARBY_PROMPT, nearbyKeyword: v })
    void (async () => {
      // 대화방: 없으면 새로 만듦 (서버를 못 쓰면 null → 이 브라우저에서만 대화)
      let id = useChatStore.getState().conversationId
      if (!id) {
        id = await createConversation('HOME_MODAL', isSummary ? 'summary' : topicId)
        if ((isSummary || isNearby) && useAuthStore.getState().token !== token) {
          setBusy(false)
          return
        }
        if (id) setConversationId(id)
      }
      if (redirect) {
        await recordExchange(id, v, redirect.text, { type: 'LINK', data: { to: '/ai', ...redirect.suggestion } })
        setBusy(false)
        return
      }
      if (isNearby) {
        void recordExchange(id, v, NEARBY_PROMPT, { type: 'LINK', data: { to: '/map', nearbyKeyword: v } })
        setBusy(false)
        return
      }
      if (isSummary) {
        const card = await loadMonthlyBudget().catch(() => null)
        if (useAuthStore.getState().token === token) {
          if (card) {
            const reply = '이번 달 수입과 지출을 정리했어요.'
            push({ role: 'bot', text: reply, card })
            void recordExchange(id, v, reply, { type: 'SPEND_SUMMARY', data: card })
          } else {
            push({ role: 'bot', text: BUDGET_LOAD_ERROR })
          }
        }
        setBusy(false)
        return
      }
      const answer = usesAiReply(selected) ? await askAi(id, v, topicId ?? 'qna') : null
      if (answer) {
        push({ role: 'bot', text: answer.text })
        setBusy(false)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 600))
      const reply = chatReply(v, selected, context)
      push({ role: 'bot', text: reply })
      void recordExchange(id, v, reply)
      setBusy(false)
    })()
  }

  /** 새 대화: 빈 대화방을 새로 만들어 두면 다음에 열어도 이 새 대화가 보임 */
  const newChat = () => {
    setGuideOpen(false)
    setTopic(null)
    setText('')
    reset()
    void createConversation('HOME_MODAL').then((id) => id && setConversationId(id))
  }

  const pick = (next: Topic, original?: string) => {
    if (next.id === 'guide') {
      setGuideOpen(true)
      return
    }
    if (original === undefined && topic?.id === next.id) {
      setTopic(null)
      return
    }
    setTopic(next)
    setText(next.input ? original ?? '' : '')
    if (next.input) requestAnimationFrame(() => input.current?.focus())
  }

  const closeChat = () => {
    setGuideOpen(false)
    setTopic(null)
    setText('')
    onClose()
  }

  const closeGuide = () => {
    setGuideOpen(false)
    requestAnimationFrame(() => topicTrigger.current?.focus({ preventScroll: true }))
  }

  const applyOpening = useEffectEvent((o: NonNullable<ChatOpening>) => {
    if ('topic' in o && o.topic === 'guide') {
      setGuideOpen(true)
      return
    }
    setGuideOpen(false)
    if ('topic' in o) {
      setTopic(topicById(o.topic))
      setText('')
    } else {
      send(o.text)
    }
  })

  // 열릴 때 첫 질문이 있으면 한 번만 보냄
  useEffect(() => {
    if (!open) {
      sentOpening.current = null
      return
    }
    let cancelled = false
    void sync().then(() => {
      if (cancelled) return
      if (opening && sentOpening.current !== opening) {
        sentOpening.current = opening
        applyOpening(opening)
      } else {
        setTimeout(() => input.current?.focus(), 50)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, opening, userId])

  useEffect(() => {
    if (!guideOpen) body.current?.scrollTo({ top: body.current.scrollHeight })
  }, [msgs, busy, open, guideOpen])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy || (!text.trim() && !summarySelected)) return
    send(text, topic)
    if (summarySelected) setTopic(null)
    setText('')
  }

  return (
    <Modal open={open} onClose={closeChat} title="AI와 대화" className={styles.chatWindow} hideClose>
      <header className={styles.chatHead}>
        <span className={styles.face} aria-hidden="true">
          🤖
        </span>
        <div className={styles.grow}>
          <b>AI와 대화</b>
          <small>데모 버전이라 정해진 주제만 답해요</small>
        </div>
        <button type="button" className={styles.chatNew} onClick={newChat} disabled={busy}>
          새 대화
        </button>
        <button type="button" className={styles.chatClose} onClick={closeChat} aria-label="닫기">
          ×
        </button>
      </header>
      {guideOpen && <UsageGuide onBack={closeGuide} onNavigate={closeChat} />}
      <div className={guideStyles.conversation} hidden={guideOpen}>
        <div className={styles.chatBody} ref={body} aria-live="polite">
          {msgs.map((m, i) => (
            <Bubble key={i} msg={m} onGoBudget={closeChat} disabled={busy} onPickTopic={pick} />
          ))}
          {busy && <div className={`${styles.msg} ${styles.bot} ${styles.typing}`}>답변을 쓰는 중…</div>}
        </div>
        <div className={styles.chatTopics}>
          <TopicPicker activeId={topic?.id} disabled={busy} triggerRef={topicTrigger} onPick={pick} />
        </div>
        {topic?.id === 'bill' && <BillPhotoQuestion key={userId} entryPoint="HOME_MODAL" onExchange={(question, answer, registered) => {
          useChatStore.getState().push({ role: 'user', text: question })
          useChatStore.getState().push({ role: 'bot', text: answer, billRegistered: registered })
        }} />}
        {topic && <SelectedTopicChip topic={topic} onClear={() => setTopic(null)} />}
        <form className={styles.chatForm} onSubmit={submit}>
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder={summarySelected ? '보내기를 눌러 수입 대비 지출을 확인하세요' : topic?.input?.placeholder ?? '궁금한 키워드나 질문을 입력하세요'} aria-label={topic?.input?.label ?? 'AI에게 보낼 메시지'} autoComplete="off" disabled={summarySelected} />
          <Button type="submit" disabled={busy || (!text.trim() && !summarySelected)}>
            보내기
          </Button>
        </form>
      </div>
    </Modal>
  )
}

function Bubble({ msg, onGoBudget, disabled, onPickTopic }: {
  msg: ChatMsg
  onGoBudget: () => void
  disabled: boolean
  onPickTopic: (topic: Topic, keyword: string) => void
}) {
  const navigate = useNavigate()
  return (
    <div className={`${styles.msg} ${msg.role === 'bot' ? styles.bot : styles.user} ${msg.card || msg.nearbyKeyword ? styles.hasCard : ''}`}>
      {msg.nearbyKeyword ? <NearbySearch key={msg.nearbyKeyword} keyword={msg.nearbyKeyword} /> : msg.text}
      {msg.suggestion && <SuggestedTopicChip suggestion={msg.suggestion} disabled={disabled} onPick={onPickTopic} />}
      {msg.billRegistered && <Button variant="line" onClick={() => { onGoBudget(); navigate('/my/budget/expense') }}>고정 지출에서 확인</Button>}
      {msg.card && (
        <BudgetSummaryCard
          card={msg.card}
          onGo={() => {
            onGoBudget()
            navigate(msg.card?.income === undefined ? '/my/budget/expense/spend' : '/my/budget')
          }}
        />
      )}
    </div>
  )
}
