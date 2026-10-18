import { useState, type FormEvent } from 'react'
import { Button, Card } from '@/components/ui'
import { CHAT_TOPICS, type AiContext } from '../topics'
import { ChatModal, type ChatOpening } from './ChatModal'
import styles from './Ai.module.css'

/** 홈 "AI와 대화" 카드: 칩·입력칸으로 바로 질문하면 대화 모달이 열림 */
export function HomeAiCard({ ctx }: { ctx: Omit<AiContext, 'hasPhoto'> }) {
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState<ChatOpening>(null)
  const [q, setQ] = useState('')

  const start = (o: ChatOpening) => {
    setOpening(o)
    setOpen(true)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    start(q.trim() ? { text: q.trim() } : null)
    setQ('')
  }

  return (
    <>
      <Card
        className={styles.homeCard}
        title="AI와 대화"
        actions={
          <button type="button" className={styles.linkBtn} onClick={() => start(null)}>
            대화 열기
          </button>
        }
      >
        <div className={styles.bubbleRow}>
          <span className={styles.face} aria-hidden="true">
            🤖
          </span>
          <p>
            안녕하세요! 자취하면서 궁금한 걸 편하게 물어보세요.
            <br />
            분리배출, 요리, 곰팡이, 보증금, 이번 달 지출까지 도와드려요.
          </p>
        </div>
        <div className={styles.chips}>
          {CHAT_TOPICS.map((t) => (
            <button key={t.id} type="button" className={styles.chip} onClick={() => start({ text: t.ask, topic: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        <form className={styles.ask} onSubmit={submit}>
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} placeholder="무엇이든 물어보세요" aria-label="AI에게 질문하기" />
          <Button type="submit">물어보기</Button>
        </form>
      </Card>
      <ChatModal open={open} onClose={() => setOpen(false)} opening={opening} ctx={ctx} />
    </>
  )
}
