import { useState, type CSSProperties } from 'react'
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
import { MonthlyBillEditor } from './MonthlyBillEditor'
import { MonthlyBillActions } from './MonthlyBillActions'
import { returnedMemoDraft } from '../ledgerMemoNavigation'

export function MonthlyFixedExpense() {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const ready = !resolving && (!preferred || preferred === timeZone)
  const [selection, setSelection] = useState<string | null>(() => returnedMemoDraft(userId, 'bill')?.month ?? null)
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
  const contractBlocked = !!(data?.contractPeriod?.outside || data?.contractPeriod?.currentOutside)
  const items = [...(data?.housingItems ?? []), ...(data?.items ?? [])]
  const housingIds = new Set(data?.housingItems?.map((item) => item.id) ?? [])
  const total = items.reduce((sum, b) => sum + b.amount, 0)
  const paid = items.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0)
  const palette = ['#6485df', '#68b6a0', '#d884aa', '#ef9b66', '#a28ad6', '#91a2b5']
  const grouped = new Map<string, number>()
  for (const bill of items) grouped.set(bill.tag, (grouped.get(bill.tag) ?? 0) + bill.amount)
  const categories = [...grouped].sort((a, b) => b[1] - a[1]).map(([name, amount], i) => ({ name, amount, color: palette[i % palette.length] }))
  let offset = 0
  const stops: string[] = []
  for (const category of categories) {
    const start = offset
    offset += total > 0 ? category.amount / total * 100 : 0
    stops.push(`${category.color} ${start}% ${offset}%`)
  }
  const choose = (value: string) => {
    if (validSelectableMonth(value, currentMonth)) setSelection(value === currentMonth ? null : value)
  }
  return <div className={common.layout}>
    <Card title={`${Number(month.slice(5))}월 고정 지출`} actions={<label className={styles.monthlyPicker}>
      <input className={common.select} type="month" min="0001-01" max={currentMonth} value={month} onChange={(e) => choose(e.target.value)} aria-label="조회 월" />
    </label>}>
      {!token || !userId ? <p>로그인 후 조회해 주세요.</p> : !ready ? <p role="status">등록 주소와 현재 위치의 시간대를 확인하고 있어요.</p> : query.isPending ? <p role="status">선택한 월을 불러오는 중이에요.</p> : null}
      {ready && query.isError && <div role="alert"><p className={common.formError}>{getErrorMessage(query.error, '월별 내역을 불러오지 못했어요.')}</p><Button variant="line" onClick={() => void query.refetch()}>다시 조회</Button></div>}
      {data && <>
        <p className={common.note}>{data.contractKind === 'monthly' ? '월세 계약 · 월세와 공통 고정 지출' : data.contractKind === 'jeonse' ? '전세 계약 · 대출 이자와 공통 고정 지출' : '계약 미등록 · 공통 고정 지출'} · <a href="/my/settings">내 집 정보 확인</a></p>
        <div className={common.sumRow}>
          <div><small>고정 지출 합계</small><b>{won(total)}</b></div>
          <div><small>납부 완료</small><b>{won(paid)}</b></div>
          <div><small>미납·예정</small><b>{won(total - paid)}</b></div>
        </div>
        {data.contractPeriod?.outside && <p className={common.note} role="status">
          선택한 {month}은 등록된 계약 기간({data.contractPeriod.from ?? '시작 미정'} ~ {data.contractPeriod.through ?? '종료 미정'}) 밖이므로 계약 비용의 자동 등록 대상에서 제외돼요. 월세·대출 이자의 예정 금액도 생성하지 않으며, 이미 저장된 내역은 표시해요. 계약 기간은 <a href="/my/settings" className={common.link}>내 집 정보</a>에서 확인해 주세요.
        </p>}
        {data.contractPeriod?.currentOutside && <p className={common.formError} role="status">현재 날짜가 계약 기간 밖이므로 등록·수정할 수 없어요. 내 집 정보의 계약 기간을 확인해 주세요.</p>}
        {total > 0 && <div className={styles.moneyDonutWrap}>
          <div className={styles.moneyDonut} style={{ background: `conic-gradient(${stops.join(', ')})` }} role="img" aria-label={`고정 지출 합계 ${won(total)}`}>
            <div className={styles.moneyDonutCenter}><small>총 지출</small><b>{won(total)}</b></div>
          </div>
          <ul className={styles.moneyLegend}>{categories.map((category) => <li key={category.name} style={{ '--c': category.color } as CSSProperties}>{category.name}<span>{Math.round(category.amount / total * 100)}% · {won(category.amount)}</span></li>)}</ul>
        </div>}
        {items.length ? <ul className={styles.fixedExpenseList} aria-label="선택 월 고정 지출">
          {items.map((bill) => <li key={bill.id} className={`${styles.moneyRow} ${styles.fixedExpenseRow}`}>
            <div className={styles.moneyDate}><b>{bill.dueDate ? Number(bill.dueDate.slice(8)) : '-'}</b><small>{bill.dueDate ? `${Number(bill.dueDate.slice(5, 7))}월` : '기한 없음'}</small></div>
            <div className={styles.moneyInfo}><b>{bill.name}</b>
              <span className={`${common.dotChip} ${common.dotChipSmall}`} style={{ '--c': categories.find((category) => category.name === bill.tag)?.color } as CSSProperties}>{bill.tag}</span>
              <small>{bill.paid ? '납부 완료' : bill.snapshot ? '미납' : '미납·예정'}{!bill.active ? ' · 해지' : ''} · 납부 기한: {bill.dueDate ?? '미등록'}</small>
              {bill.paidAt && <small>납부: {formatLocalTime(bill.paidAt, data.timeZone)}</small>}
            </div>
            <div className={styles.moneyAmt}>{won(bill.amount)}</div>
            <details className={styles.fixedExpenseActions} key={`menu:${userId}:${token}:${timeZone}:${month}:${bill.id}`}>
              <summary aria-label={`${bill.name} 고정 지출 설정`} title="고정 지출 설정">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 17h16" />
                  <circle cx="9" cy="7" r="3" />
                  <circle cx="15" cy="17" r="3" />
                </svg>
              </summary>
              <div className={styles.fixedExpenseActionList}>
            <MonthlyBillActions key={`actions:${userId}:${token}:${timeZone}:${month}:${bill.id}`} bill={bill} month={month} timeZone={timeZone} housing={housingIds.has(bill.id)} />
            {housingIds.has(bill.id) || bill.homeManaged ? <a href="/my/settings" className={common.link}>내 집 정보에서 확인</a> : contractBlocked ? <span>계약 기간 밖 · 수정 불가</span> : bill.paid ? <span>납부 완료 · 수정 불가</span> : <MonthlyBillEditor key={`${userId}:${token}:${timeZone}:${month}:${bill.id}`} month={month} timeZone={timeZone} bill={bill} />}
              </div>
            </details>
          </li>)}
        </ul> : <p className={common.empty}>이 달에는 고정 지출 기록이 없어요. 첫 고정 지출을 기록해 보세요.</p>}
        <details className={styles.fixedExpenseDetails}><summary>조회 정보</summary>
          <p className={common.note}>계약에 따른 월세 또는 전세 대출 이자와 공통 고정 지출을 합산해요. 현재 월에는 예정 금액도 포함하며, 이자 계산 기록은 납부 완료를 뜻하지 않아요.</p>
          <p className={common.note}>{choice?.source === 'address' ? '등록 주소' : choice?.source === 'location' ? '현재 위치' : '기기 설정'} · {timeZone} 기준</p>
          <p className={common.note}>청구 기간: {formatLocalTime(data.periodFrom, data.timeZone)} ~ {formatLocalTime(data.periodThrough, data.timeZone)}</p>
          <p className={common.note}>조회 시각: {formatLocalTime(data.queriedAt, data.timeZone)}{query.isFetching ? ' · 갱신 중' : ''}</p>
          <div className={styles.monthlyToolbar}><Button variant="line" onClick={() => setSelection(null)} disabled={month === currentMonth}>이번 달</Button><Button variant="line" onClick={() => void query.refetch()} disabled={!ready || query.isFetching}>새로고침</Button></div>
        </details>
      </>}
    </Card>
    <Card title="고정 지출 기록하기">
      {data && !!token && !!userId && !query.isError && !contractBlocked ? <MonthlyBillEditor key={`${userId}:${token}:${timeZone}:${month}`} month={month} timeZone={timeZone} /> : <p className={common.note}>현재 날짜와 조회 월이 모두 계약 기간 안이어야 기록할 수 있어요.</p>}
      <p className={common.note}>선택한 달의 고정 지출을 기록해요. 등록된 기록만 수정할 수 있어요.</p>
    </Card>
  </div>
}
