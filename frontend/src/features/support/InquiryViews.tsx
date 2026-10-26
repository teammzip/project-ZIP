import { useState, type FormEvent } from 'react'
import { Button, Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { useSupportStore, type Inquiry } from './store'
import styles from './Support.module.css'

export const SUPPORT_NOTICE = '현재 문의는 이 브라우저에만 저장되며 운영자에게 전송되지 않아요. 같은 브라우저의 관리자 화면에서 확인·답변할 수 있어요.'
const dateText = (value: string) => new Date(value).toLocaleString('ko-KR')

export function InquiryStatus({ inquiry }: { inquiry: Inquiry }) {
  return <span className={cx(styles.badge, inquiry.answer && styles.answered)}>{inquiry.answer ? '답변 완료' : '답변 대기'}</span>
}

export function InquiryDetail({ inquiry, admin = false }: { inquiry: Inquiry; admin?: boolean }) {
  return (
    <Card title={inquiry.title} className={styles.detail}>
      <div className={styles.meta}>
        <InquiryStatus inquiry={inquiry} />
        <span>{inquiry.category}</span>
        {admin && <span>{inquiry.nickname}</span>}
        <time dateTime={inquiry.createdAt}>{dateText(inquiry.createdAt)}</time>
      </div>
      <p className={styles.content}>{inquiry.content}</p>
      {inquiry.answer ? (
        <section className={styles.answer} aria-label="관리자 답변">
          <h3>관리자 답변</h3>
          <time className={styles.meta} dateTime={inquiry.answer.createdAt}>{dateText(inquiry.answer.createdAt)}</time>
          <p className={styles.content}>{inquiry.answer.content}</p>
        </section>
      ) : admin ? <ReplyForm key={inquiry.id} id={inquiry.id} /> : <p className={styles.notice}>답변이 등록되면 이 화면에서 확인할 수 있어요.</p>}
    </Card>
  )
}

function ReplyForm({ id }: { id: string }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const reply = useSupportStore((s) => s.reply)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      reply(id, content)
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변을 저장하지 못했어요.')
    }
  }
  return (
    <form className={common.form} onSubmit={submit}>
      <label>답변 내용<textarea required maxLength={3000} rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="문의에 대한 답변을 작성해 주세요." /></label>
      {error && <p className={common.formError} role="alert">{error}</p>}
      <div className={styles.actions}><Button type="submit" disabled={!content.trim()}>답변 등록</Button></div>
    </form>
  )
}

export function InquiryList({ inquiries, onSelect, admin = false }: { inquiries: Inquiry[]; onSelect: (id: string) => void; admin?: boolean }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const rows = inquiries.filter((q) =>
    (filter === 'all' || (filter === 'answered' ? !!q.answer : !q.answer)) &&
    `${q.title} ${q.content} ${admin ? q.nickname : ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <div className={styles.list}>
      <div className={styles.tools}>
        <input className={common.input} type="search" aria-label="문의 검색" placeholder={admin ? '제목·내용·작성자 검색' : '제목·내용 검색'} value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className={common.select} aria-label="답변 상태" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">전체 ({inquiries.length})</option>
          <option value="pending">답변 대기</option>
          <option value="answered">답변 완료</option>
        </select>
      </div>
      {!rows.length && <p className={common.empty}>{inquiries.length ? '조건에 맞는 문의가 없어요.' : '아직 등록된 문의가 없어요.'}</p>}
      {rows.map((q) => (
        <button className={styles.item} key={q.id} type="button" onClick={() => onSelect(q.id)}>
          <span className={styles.meta}><InquiryStatus inquiry={q} /><span>{q.category}</span></span>
          <strong>{q.title}</strong>
          <span className={styles.meta}>{admin && <span>{q.nickname}</span>}<time dateTime={q.createdAt}>{dateText(q.createdAt)}</time></span>
        </button>
      ))}
    </div>
  )
}
