import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { useBillingTimeZone } from '@/features/life/useBillingTimeZone'
import { useLocalMonth } from '@/features/life/useLocalMonth'
import { createConversation, type EntryPoint } from '../api'
import common from '@/styles/common.module.css'
import styles from './AiChat.module.css'

type Props = {
  entryPoint: EntryPoint
  onExchange: (question: string, answer: string, registered: boolean) => void
}
export function BillPhotoQuestion({ entryPoint, onExchange }: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const client = useQueryClient()
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const ready = !resolving && (!preferred || preferred === timeZone)
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [question, setQuestion] = useState('이 고지서의 금액과 납부 기한을 읽어 주세요.')
  const [draft, setDraft] = useState<{ id: string; conversation: string; answer: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    if (busy || draft || !photo || !ready || !userId || !token) return
    if (!photo.size || photo.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(photo.type)) { setError('2MB 이하의 JPG 또는 PNG 고지서를 선택해 주세요.'); return }
    if (!question.trim()) { setError('질문을 입력해 주세요.'); return }
    const owner = { userId, token }
    const current = () => useAuthStore.getState().user?.id === owner.userId && useAuthStore.getState().token === owner.token
    setBusy(true); setError('')
    try {
      const id = await createConversation(entryPoint, 'bill')
      if (!current()) return
      if (!id) throw new Error('로그인과 서버 연결을 확인해 주세요. 대화방을 만들지 못했어요.')
      const body = new FormData()
      body.append('photo', photo); body.append('question', question.trim())
      const { data } = await apiClient.post<{ draftId: string; reply: { text: string } }>(`/ai/conversations/${id}/bill-photo`, body, { params: { month: currentMonth, timeZone }, timeout: 45000 })
      if (!current()) return
      onExchange(question.trim(), data.reply.text, false)
      setDraft({ id: data.draftId, conversation: id, answer: data.reply.text })
      setPhoto(null); setOpen(false)
    } catch (e) { if (current()) setError(getErrorMessage(e, '고지서를 읽지 못했어요. 다시 시도해 주세요.')) }
    finally { setBusy(false) }
  }
  const decide = async (register: boolean) => {
    if (!draft || busy || !token || !userId) return
    const owner = { userId, token }
    const current = () => useAuthStore.getState().user?.id === owner.userId && useAuthStore.getState().token === owner.token
    setBusy(true); setError('')
    try {
      const { data } = await apiClient.post<{ registered: boolean; reply: { text: string } }>(
        '/ai/conversations/' + draft.conversation + '/bill-photo/' + draft.id + '/decision', { register })
      if (!current()) return
      onExchange(register ? '가계부에 등록해 주세요.' : '등록하지 않을게요.', data.reply.text, data.registered)
      setDraft(null)
      if (data.registered) await client.invalidateQueries({ queryKey: ['monthly-bills'] })
    } catch (e) { if (current()) setError(getErrorMessage(e, '등록 여부를 처리하지 못했어요.')) }
    finally { setBusy(false) }
  }
  return <div className={styles.billQuestion}>
    <Button variant="line" onClick={() => setOpen(!open)} disabled={busy || !!draft}>고지서 사진·QR로 물어보기</Button>
    {open && <form onSubmit={(e) => { e.preventDefault(); void send() }} className={common.form}>
      <label>저장된 사진 선택<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(e) => { if (e.target.files?.[0]) { setPhoto(e.target.files[0]); setError('') } e.target.value = '' }} /></label>
      <label>카메라로 촬영<input type="file" accept="image/jpeg,image/png" capture="environment" disabled={busy} onChange={(e) => { if (e.target.files?.[0]) { setPhoto(e.target.files[0]); setError('') } e.target.value = '' }} /></label>
      {photo && <p role="status">선택한 사진: {photo.name}</p>}
      <label>질문<input value={question} maxLength={2000} disabled={busy} onChange={(e) => setQuestion(e.target.value)} /></label>
      <p className={common.note}>사진·QR을 읽어 금액과 납부 기한을 안내해요. 확인 후 등록에 동의하시면 {currentMonth} 고정 지출에 저장해요. QR에 링크만 있으면 고지서 전체 사진이 필요해요.</p>
      <Button type="submit" disabled={busy || !photo || !ready || !token}>{busy ? '고지서를 읽는 중' : '고지서 읽기'}</Button>
      {!token && <p>로그인 후 이용해 주세요.</p>}
    </form>}
    {draft && <section aria-label="고지서 등록 확인">
      <p>{draft.answer}</p>
      <Button disabled={busy} onClick={() => void decide(true)}>가계부에 등록</Button>
      <Button variant="line" disabled={busy} onClick={() => void decide(false)}>등록 안 함</Button>
    </section>}
    {error && <p role="alert" className={common.formError}>{error}</p>}
  </div>
}
