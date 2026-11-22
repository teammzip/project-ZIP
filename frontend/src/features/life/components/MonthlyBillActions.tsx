import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { setMonthlyBillPaid, terminateMonthlyBill, type ServerBill } from '../billsApi'
import common from '@/styles/common.module.css'

function localToday(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map((name) => parts.find((part) => part.type === name)?.value).join('-')
}

export function MonthlyBillActions({ bill, month, timeZone, housing = false }: { bill: ServerBill; month: string; timeZone: string; housing?: boolean }) {
  const client = useQueryClient()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [terminating, setTerminating] = useState(false)
  const [date, setDate] = useState('')
  const [today, setToday] = useState(() => localToday(timeZone))
  useEffect(() => {
    const refresh = () => setToday(localToday(timeZone))
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [timeZone])
  const run = async (task: () => Promise<void>, message: string) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await task(); setTerminating(false); setNotice(message)
      await client.invalidateQueries({ queryKey: ['monthly-bills'] })
      if (bill.id.startsWith('rent:')) await client.invalidateQueries({ queryKey: ['notifications'] })
    } catch (cause) { setError(getErrorMessage(cause, '처리하지 못했어요. 다시 시도해 주세요.')) }
    finally { pending.current = false; setBusy(false) }
  }
  return <div>
    {bill.snapshot && <Button variant="line" disabled={busy} onClick={() => {
      if (bill.paid && !window.confirm('납부 완료를 취소하고 미납 상태로 되돌릴까요?')) return
      void run(() => setMonthlyBillPaid(bill.id, month, timeZone, !bill.paid), bill.paid ? '납부를 취소했어요.' : '납부 완료로 표시했어요.')
    }}>{bill.paid ? '납부 취소' : '납부 완료'}</Button>}
    {!housing && !bill.homeManaged && bill.active && !bill.terminationDate && <Button variant="line" disabled={busy} onClick={() => { setTerminating(true); setError('') }}>정기 지출 해지</Button>}
    {bill.terminationDate && <p role="status">해지 적용일: {bill.terminationDate}</p>}
    {terminating && <form aria-label="고정 지출 해지" onSubmit={(event) => {
      event.preventDefault()
      if (!date || date < localToday(timeZone)) { setError('해지 적용일은 오늘 이후로 입력해 주세요.'); return }
      if (!window.confirm(`${date}부터 해지할까요? 적용일 이후의 미납·예정 내역은 제외하고 납부 완료 기록은 유지해요.`)) return
      void run(() => terminateMonthlyBill(bill.id, timeZone, date), '해지 적용일을 저장했어요.')
    }}>
      <label>해지 적용일<input type="date" required min={today} value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} /></label>
      <p>입력한 날짜부터 정기 지출을 중단하고, 납부 기한이 해당 날짜 이후인 미납·예정 내역을 제외해요. 이전 기록과 납부 완료 기록은 유지해요. 한 달 기록만 지우려면 이번 달 기록 삭제를 이용해 주세요.</p>
      <Button type="submit" disabled={busy || !date}>해지 적용</Button>
      <Button type="button" variant="line" disabled={busy} onClick={() => setTerminating(false)}>취소</Button>
    </form>}
    {error && <p role="alert" className={common.formError}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </div>
}
