import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { spendBreakdown, useLifeStore } from '@/features/life'
import { useLoanStore } from '@/features/loan'
import { useAuthStore } from '@/features/auth/store/authStore'
import { getHousingContractKind } from '@/features/onboarding/useHousingContract'
import { man, won } from '@/lib/date'
import { askAi, createConversation, loadLatestConversation, recordExchange } from '../api'
import { useChatStore, type ChatMsg, type SpendCard } from '../store'
import { CHAT_TOPICS, SUMMARY_ASK, chatReply, type AiContext, type Topic } from '../topics'
import styles from './Ai.module.css'
import { TopicCards } from './TopicCards'
import { BillPhotoQuestion } from './BillPhotoQuestion'

/** 대화를 열 때 바로 보낼 첫 질문 (홈 카드의 칩·입력칸에서) */
export type ChatOpening = { text: string; topic?: string } | null

type Props = {
  open: boolean
  onClose: () => void
  opening: ChatOpening
  ctx: Omit<AiContext, 'hasPhoto'>
}

/** 분야 카드를 눌렀을 때 보낼 질문 (CHAT_TOPICS 에 없는 분야용) */
const EXTRA_ASK: Record<string, string> = {
  guide: '이 앱 사용 방법이 궁금해요',
  nearby: '근처 세탁방이나 편의점 알려줘',
  landlord: '집주인에게 보낼 문자 써줘',
}

/** 받침이 있으면 "이", 없으면 "가" */
const subj = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00
  return c >= 0 && c % 28 ? '이' : '가'
}

/** 가계부 기록으로 이번 달 지출 요약 카드 숫자를 만듦 */
function makeSpendCard(): SpendCard {
  const { spends, bills, settings } = useLifeStore.getState()
  const userId = useAuthStore.getState().user?.id
  const charges = useLoanStore.getState().charges.filter((charge) => charge.userId === userId)
  const kind = getHousingContractKind()
  const cur = spendBreakdown(0, spends, bills, settings, charges, kind)
  const prev = spendBreakdown(1, spends, bills, settings, charges, kind)
  const vari = cur.rows.filter(([n]) => n !== '월세' && n !== '공과금' && n !== '대출 이자')
  return { month: cur.month, total: cur.total, prevTotal: prev.total, fixed: cur.fixed, rows: cur.rows.slice(0, 5), top: vari[0] ?? null }
}

/** 홈 "AI와 대화" 모달. 대화는 서버 DB(ai_conversations · ai_messages)에 저장돼서 다시 열면 이어짐 (서버를 안 쓰면 이 브라우저에만). 자유 질문은 서버의 AI(Gemini)가 답하고, AI 를 쓸 수 없으면 데모 답변 */
export function ChatModal({ open, onClose, opening, ctx }: Props) {
  const { push, reset, load, setConversationId, msgs } = useChatStore()
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [photoTopic, setPhotoTopic] = useState<string | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
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

  const send = (q: string, topic?: string) => {
    const v = q.trim()
    if (!v || busy) return
    setBusy(true)
    push({ role: 'user', text: v })
    void (async () => {
      const isSummary = topic === 'summary' || SUMMARY_ASK.test(v)
      // 대화방: 없으면 새로 만듦 (서버를 못 쓰면 null → 이 브라우저에서만 대화)
      let id = useChatStore.getState().conversationId
      if (!id) {
        id = await createConversation('HOME_MODAL', topic)
        if (id) setConversationId(id)
      }
      // 자유 질문(분야 없음 · 질문 분야)은 서버의 AI 가 답하고 질문·답이 저장됨. 그 밖의 답은 앱 안에서 만들고 따로 저장
      const answer = !isSummary && (!topic || topic === 'qna') ? await askAi(id, v, topic) : null
      if (answer) {
        push({ role: 'bot', text: answer.text })
        setBusy(false)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 600))
      const card = isSummary ? makeSpendCard() : undefined
      const reply = isSummary ? '이번 달 지출을 정리해 봤어요.' : chatReply(v, topic, { ...ctx, hasPhoto: false })
      push(card ? { role: 'bot', text: reply, card } : { role: 'bot', text: reply })
      void recordExchange(id, v, reply, card)
      setBusy(false)
    })()
  }

  /** 새 대화: 빈 대화방을 새로 만들어 두면 다음에 열어도 이 새 대화가 보임 */
  const newChat = () => {
    setPhotoTopic(null)
    reset()
    void createConversation('HOME_MODAL').then((id) => id && setConversationId(id))
  }

  // 카드: 정해진 질문이 있으면 바로 보내고, 없으면(자유 질문) 입력칸으로
  const pick = (tp: Topic) => {
    setPhotoTopic(tp.id)
    const ask = CHAT_TOPICS.find((c) => c.id === tp.id)?.ask ?? EXTRA_ASK[tp.id]
    if (ask) send(ask, tp.id)
    else input.current?.focus()
  }

  const sendOpening = useEffectEvent((o: NonNullable<ChatOpening>) => send(o.text, o.topic))

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
        sendOpening(opening)
      } else {
        setTimeout(() => input.current?.focus(), 50)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, opening, userId])

  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight })
  }, [msgs, busy, open])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
    setText('')
  }

  return (
    <Modal open={open} onClose={onClose} title="AI와 대화" className={styles.chatWindow} hideClose>
      <header className={styles.chatHead}>
        <span className={styles.face} aria-hidden="true">
          🤖
        </span>
        <div className={styles.grow}>
          <b>AI와 대화</b>
          <small>데모 버전이라 정해진 주제만 답해요</small>
        </div>
        <button type="button" className={styles.chatNew} onClick={newChat}>
          새 대화
        </button>
        <button type="button" className={styles.chatClose} onClick={onClose} aria-label="닫기">
          ×
        </button>
      </header>
      <div className={styles.chatBody} ref={body} aria-live="polite">
        {msgs.map((m, i) => (
          <Bubble key={i} msg={m} onGoBudget={onClose} />
        ))}
        {busy && <div className={`${styles.msg} ${styles.bot} ${styles.typing}`}>답변을 쓰는 중…</div>}
      </div>
      <TopicCards className={styles.chatCards} disabled={busy} onPick={pick} />
      {photoTopic === 'bill' && <BillPhotoQuestion key={userId} entryPoint="HOME_MODAL" onExchange={(question, answer, registered) => {
        useChatStore.getState().push({ role: 'user', text: question })
        useChatStore.getState().push({ role: 'bot', text: answer, billRegistered: registered })
      }} />}
      <form className={styles.chatForm} onSubmit={submit}>
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={80} placeholder="궁금한 걸 입력하세요" aria-label="AI에게 보낼 메시지" autoComplete="off" />
        <Button type="submit" disabled={busy}>
          보내기
        </Button>
      </form>
    </Modal>
  )
}

function Bubble({ msg, onGoBudget }: { msg: ChatMsg; onGoBudget: () => void }) {
  const navigate = useNavigate()
  return (
    <div className={`${styles.msg} ${msg.role === 'bot' ? styles.bot : styles.user} ${msg.card ? styles.hasCard : ''}`}>
      {msg.text}
      {msg.billRegistered && <Button variant="line" onClick={() => { onGoBudget(); navigate('/my/budget/expense') }}>고정 지출에서 확인</Button>}
      {msg.card && (
        <SpendCardView
          card={msg.card}
          onGo={() => {
            onGoBudget()
            navigate('/my/budget/expense/spend')
          }}
        />
      )}
    </div>
  )
}

function SpendCardView({ card: c, onGo }: { card: SpendCard; onGo: () => void }) {
  const diff = c.total - c.prevTotal
  const max = c.rows[0]?.[1] || 1
  const pct = c.total ? Math.round((c.fixed / c.total) * 100) : 0
  return (
    <div className={styles.sumCard}>
      <small>{c.month}월 지출 요약</small>
      <b className={styles.sumTotal}>{won(c.total)}</b>
      <p className={diff > 0 ? styles.sumUp : styles.sumCmp}>
        {c.prevTotal ? `지난달보다 ${diff === 0 ? '같아요' : `${man(Math.abs(diff))} ${diff > 0 ? '더 썼어요' : '덜 썼어요'}`}` : '지난달 기록이 없어요'}
      </p>
      <div className={styles.sumRows}>
        {c.rows.map(([n, v]) => (
          <div key={n} className={styles.sumRow}>
            <span className={styles.sumName}>{n}</span>
            <span className={styles.sumBar}>
              <i style={{ width: `${Math.max((v / max) * 100, 3)}%` }} />
            </span>
            <span className={styles.sumVal}>{man(v)}</span>
          </div>
        ))}
      </div>
      <p className={styles.sumNote}>
        고정 지출 {pct}% · 변동 지출 {100 - pct}%
        {c.top && `\n변동 지출 중 ${c.top[0]}${subj(c.top[0])} 가장 커요 (${man(c.top[1])})`}
      </p>
      <button type="button" className={styles.sumGo} onClick={onGo}>
        가계부에서 자세히 보기
      </button>
    </div>
  )
}
