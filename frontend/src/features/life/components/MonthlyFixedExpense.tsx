import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { won } from '@/lib/date'
import common from '@/styles/common.module.css'
import { getMonthlyBills } from '../billsApi'
import { useLocalMonth } from '../useLocalMonth'
import { useBillingTimeZone } from '../useBillingTimeZone'
import { formatLocalTime, selectedMonth, validSelectableMonth } from '../monthlyPeriod'
import styles from './life.module.css'

export function MonthlyFixedExpense() {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const ready = !resolving && (!preferred || preferred === timeZone)
  const [selection, setSelection] = useState<string | null>(null)
  const month = selectedMonth(selection, currentMonth)
  const query = useQuery({
    queryKey: ['monthly-bills', userId, token, timeZone, month],
    queryFn: ({ signal }) => getMonthlyBills(month, timeZone, signal),
    enabled: !!userId && !!token && ready,
    gcTime: 0, staleTime: 0,
    refetchInterval: month === currentMonth ? 60000 : false,
    refetchOnWindowFocus: 'always', retry: false,
  })
  const data = ready ? query.data : undefined
  const items = data?.items ?? []
  const total = items.reduce((sum, b) => sum + b.amount, 0)
  const paid = items.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0)
  const choose = (value: string) => {
    if (validSelectableMonth(value, currentMonth)) setSelection(value === currentMonth ? null : value)
  }
  return <div className={common.stack}>
    <Card title="고정 지출 월별 조회" actions={<label className={styles.monthlyPicker}>조회 월
      <input type="month" min="0001-01" max={currentMonth} value={month} onChange={(e) => choose(e.target.value)} aria-label="조회 월" />
    </label>}>
      <p className={common.note}>공과금·통신·구독·별도 관리비 기준이에요.</p>
      <div className={styles.monthlyToolbar}>
        <span>{ready ? `${choice?.source === 'address' ? '등록 주소' : choice?.source === 'location' ? '현재 위치' : '기기 설정'} · ${timeZone} 기준` : '조회 시간대를 확인하고 있어요.'}</span>
        <Button variant="line" onClick={() => setSelection(null)} disabled={month === currentMonth}>이번 달</Button>
        <Button variant="line" onClick={() => void query.refetch()} disabled={!ready || query.isFetching}>새로고침</Button>
      </div>
      {!token || !userId ? <p>로그인 후 조회해 주세요.</p> : !ready ? <p role="status">등록 주소와 현재 위치의 시간대를 확인하고 있어요.</p> : query.isPending ? <p role="status">선택한 월을 불러오는 중이에요.</p> : null}
      {ready && query.isError && <div role="alert"><p className={common.formError}>{getErrorMessage(query.error, '월별 내역을 불러오지 못했어요.')}</p><Button variant="line" onClick={() => void query.refetch()}>다시 조회</Button></div>}
      {data && <>
        <p className={common.note}>청구 기간: {formatLocalTime(data.periodFrom, data.timeZone)} ~ {formatLocalTime(data.periodThrough, data.timeZone)}</p>
        <p className={common.note}>조회 시각: {formatLocalTime(data.queriedAt, data.timeZone)}{query.isFetching ? ' · 갱신 중' : ''}</p>
        <div className={common.sumRow}>
          <div><small>고정 지출 합계</small><b>{won(total)}</b></div>
          <div><small>납부 완료</small><b>{won(paid)}</b></div>
          <div><small>미납·예정</small><b>{won(total - paid)}</b></div>
        </div>
        <p className={common.note}>현재 월에는 미납·예정 금액도 포함돼요. 납부 상태는 조회 시점 기준이에요.</p>
        {items.length ? <ul className={styles.monthlyList} aria-label="선택 월 고정 지출">
          {items.map((bill) => <li key={bill.id} className={styles.monthlyItem}>
            <div><strong>{bill.name}</strong><small>{bill.tag} · {bill.paid ? '납부 완료' : bill.snapshot ? '미납' : '미납·예정'}{!bill.active ? ' · 해지' : ''}</small>
              {bill.paidAt && <small>납부: {formatLocalTime(bill.paidAt, data.timeZone)}</small>}</div>
            <strong>{won(bill.amount)}</strong>
          </li>)}
        </ul> : <p className={common.empty}>선택한 월에 조회할 고정 지출이 없어요.</p>}
      </>}
    </Card>
  </div>
}
