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
  ensureConversation?: () => Promise<string | null>
  onExchange: (question: string, answer: string) => void
}
export function BillPhotoQuestion({ entryPoint, ensureConversation, onExchange }: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const client = useQueryClient()
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const ready = !resolving && (!preferred || preferred === timeZone)
  const [open, setOpen] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [question, setQuestion] = useState('이 고지서의 금액과 납부 기한을 읽고 고정 지출에 등록해 주세요.')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    if (busy || !photo || !ready || !userId || !token) return
    if (!photo.size || photo.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(photo.type)) { setError('2MB 이하의 JPG 또는 PNG 고지서를 선택해 주세요.'); return }
    if (!question.trim()) { setError('질문을 입력해 주세요.'); return }
    const owner = { userId, token }
    const current = () => useAuthStore.getState().user?.id === owner.userId && useAuthStore.getState().token === owner.token
    setBusy(true); setError('')
    try {
      const id = ensureConversation ? await ensureConversation() : await createConversation(entryPoint)
      if (!current()) return
      if (!id) throw new Error('로그인과 서버 연결을 확인해 주세요. 대화방을 만들지 못했어요.')
      const body = new FormData()
      body.append('photo', photo); body.append('question', question.trim())
      const { data } = await apiClient.post<{ reply: { text: string } }>(`/ai/conversations/${id}/bill-photo`, body, { params: { month: currentMonth, timeZone }, timeout: 45000 })
      if (!current()) return
      onExchange(question.trim(), data.reply.text)
      await client.invalidateQueries({ queryKey: ['monthly-bills'] })
      setPhoto(null); setOpen(false)
    } catch (e) { if (current()) setError(getErrorMessage(e, '고지서를 읽지 못했어요. 다시 시도해 주세요.')) }
    finally { setBusy(false) }
  }
  return <div className={styles.billQuestion}>
    <Button variant="line" onClick={() => setOpen(!open)} disabled={busy}>고지서 사진으로 물어보기</Button>
    {open && <form onSubmit={(e) => { e.preventDefault(); void send() }} className={common.form}>
      <label>고지서 사진<input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); setError('') }} /></label>
      <label>질문<input value={question} maxLength={2000} disabled={busy} onChange={(e) => setQuestion(e.target.value)} /></label>
      <p className={common.note}>사진을 Gemini에 보내 읽은 금액·납부 기한을 {currentMonth} 고정 지출에 자동 등록해요. 읽을 수 없으면 저장하지 않아요.</p>
      <Button type="submit" disabled={busy || !photo || !ready || !token}>{busy ? '고지서를 읽고 등록하는 중' : '물어보고 자동 등록'}</Button>
      {!token && <p>로그인 후 이용해 주세요.</p>}
    </form>}
    {error && <p role="alert" className={common.formError}>{error}</p>}
  </div>
}
