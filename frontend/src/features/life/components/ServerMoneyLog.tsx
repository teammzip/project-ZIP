import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AmountInput, Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import { won } from '@/lib/date'
import { getLedger, saveLedger, deleteLedger, type LedgerKind, type LedgerRow } from '../ledgerApi'
import { getSalary } from '../salaryApi'
import { useBillingTimeZone } from '../useBillingTimeZone'
import { useLocalMonth } from '../useLocalMonth'
import { selectedMonth } from '../monthlyPeriod'
import { useLedgerCategorySettings } from '../ledgerCategories'
import { LedgerCategoryDialog } from './LedgerCategoryDialog'
import common from '@/styles/common.module.css'
import styles from './life.module.css'
import { returnedMemoDraft, openLedgerMemo, clearMemoDraft, discardMemoDraft, rememberLedgerValues } from '../ledgerMemoNavigation'

const incomeSettingsPath = '/my/settings?section=income'

export function ServerMoneyLog({ kind, incomeType = 'fixed' }: { kind: LedgerKind; incomeType?: 'fixed' | 'other' }) {
  const user = useAuthStore((s) => s.user?.id), sessionKey = useAuthStore((s) => s.sessionKey)
  return <AccountMoneyLog key={`${user}:${sessionKey}:${kind}:${incomeType}`} kind={kind} incomeType={incomeType} />
}

function AccountMoneyLog({ kind, incomeType }: { kind: LedgerKind; incomeType: 'fixed' | 'other' }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user?.id), sessionKey = useAuthStore((s) => s.sessionKey)
  const { choice, resolving } = useBillingTimeZone()
  const preferred = choice?.source === 'device' ? undefined : choice?.timeZone
  const { timeZone, currentMonth } = useLocalMonth(preferred)
  const ready = !resolving && (!preferred || preferred === timeZone)
  const [resume] = useState(() => returnedMemoDraft(user, kind, kind === 'income' ? incomeType : undefined))
  const [selection, setSelection] = useState<string | null>(resume?.month ?? null)
  const month = selectedMonth(selection, currentMonth)
  const title = kind === 'spend' ? '기타 지출' : incomeType === 'fixed' ? '고정 수입' : '기타 수입'
  const query = useQuery({ queryKey: ['ledger', user, sessionKey, kind, incomeType, timeZone, month], queryFn: ({ signal }) => getLedger(kind, month, timeZone, incomeType, signal), enabled: !!user && !!sessionKey && ready, gcTime: 0, staleTime: 0, refetchInterval: 60000, retry: false })
  const rows = query.data ?? []
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const totals = new Map<string, number>()
  rows.forEach((row) => totals.set(row.cat, (totals.get(row.cat) ?? 0) + row.amount))
  const top = [...totals].sort((a, b) => b[1] - a[1])[0]?.[0]
  const colors = ['#6485df', '#68b6a0', '#d884aa', '#ef9b66', '#a28ad6', '#91a2b5']
  const { groups } = [...totals].sort((a, b) => b[1] - a[1]).reduce<{
    percentage: number
    groups: { name: string; amount: number; color: string; stop: string }[]
  }>((previous, [name, amount], index) => {
    const percentage = previous.percentage + (total ? amount / total * 100 : 0)
    const color = colors[index % colors.length]
    return {
      percentage,
      groups: [...previous.groups, { name, amount, color, stop: `${color} ${previous.percentage}% ${percentage}%` }],
    }
  }, { percentage: 0, groups: [] })
  const [editing, setEditing] = useState<LedgerRow | undefined>(() => resume?.row as LedgerRow | undefined)
  const [formVersion, setFormVersion] = useState(0)
  return <div className={common.layout}>
    <Card title={`${Number(month.slice(5))}월 ${title}`} actions={<label className={styles.monthlyPicker}><input type="month" className={common.select} value={month} max={currentMonth} aria-label="월 선택" onChange={(event) => setSelection(event.target.value || null)} /></label>}>
      {user && sessionKey && kind === 'income' && incomeType === 'fixed' && <Link to={incomeSettingsPath} className={common.link}>월·연 수입 설정</Link>}
      {!user || !sessionKey ? <p>로그인 후 조회해 주세요.</p> : !ready || query.isPending ? <p role="status">불러오는 중이에요.</p> : query.isError ? <p role="alert">{getErrorMessage(query.error, '조회하지 못했어요.')} <Button onClick={() => void query.refetch()}>다시 조회</Button></p> : <>
        <p className={common.note}>{kind === 'spend' ? '선택한 달에 기록한 기타 지출' : '선택한 달에 실제로 받은 수입'} · 분류별 합계와 기록 확인</p>
        <div className={common.sumRow}><div><small>{title} 합계</small><b>{won(total)}</b></div><div><small>기록</small><b>{rows.length}건</b></div><div><small>{kind === 'spend' ? '가장 많이 쓴 곳' : '가장 큰 수입'}</small><b>{top ?? '-'}</b></div></div>
        {total > 0 && <div className={styles.moneyDonutWrap}><div className={styles.moneyDonut} style={{ background: `conic-gradient(${groups.map((group) => group.stop).join(', ')})` }} role="img" aria-label={`${title} 합계 ${won(total)}`}><div className={styles.moneyDonutCenter}><small>총 {kind === 'income' ? '수입' : '지출'}</small><b>{won(total)}</b></div></div><ul className={styles.moneyLegend}>{groups.map((group) => <li key={group.name} style={{ '--c': group.color } as CSSProperties}>{group.name}<span>{Math.round(group.amount / total * 100)}% · {won(group.amount)}</span></li>)}</ul></div>}
        <ul className={styles.fixedExpenseList} aria-label={`선택 월 ${title}`}>{rows.map((row) => <li key={row.id} className={`${styles.moneyRow} ${styles.fixedExpenseRow}`}>
          <div className={styles.moneyDate}><b>{Number(row.date.slice(8))}</b><small>{Number(row.date.slice(5, 7))}월</small></div>
          <div className={styles.moneyInfo}>
            <span className={`${common.dotChip} ${common.dotChipSmall}`} style={{ '--c': groups.find((group) => group.name === row.cat)?.color } as CSSProperties}>{row.cat}</span>
            <small>{kind === 'income' ? '수입일' : '지출일'}: {row.date}</small>
          </div><div className={styles.moneyAmt}>{won(row.amount)}</div>
          <details className={styles.fixedExpenseActions}><summary aria-label={`${row.cat} 기록 설정`} title="기록 설정"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></svg></summary><div className={styles.fixedExpenseActionList}>
            {row.salaryManaged || (row.salaryCategory ?? (kind === 'income' && incomeType === 'fixed' && row.cat === '월급'))
              ? <Button variant="line" onClick={() => navigate(`${incomeSettingsPath}&edit=income`)}>수정</Button>
              : <Button variant="line" onClick={() => { setEditing(row); setFormVersion((value) => value + 1) }}>수정</Button>}
            <DeleteRecord kind={kind} row={row} clearsSalary={row.salaryManaged || (row.salaryCategory ?? (kind === 'income' && incomeType === 'fixed' && row.cat === '월급'))} />
          </div></details>
        </li>)}</ul>
        {!rows.length && <p className={common.empty}>이 달에는 기록이 없어요.</p>}
      </>}
    </Card>
    <Card title={`${title} ${editing ? '수정' : '기록하기'}`}>
      {!!user && !!sessionKey && ready && <LedgerForm key={`${user}:${sessionKey}:${kind}:${incomeType}:${timeZone}:${formVersion}`} kind={kind} incomeType={incomeType} timeZone={timeZone} row={editing} onDone={(date) => { if (date) setSelection(date.slice(0, 7)); setEditing(undefined); setFormVersion((value) => value + 1) }} />}
      <p className={common.note}>{kind === 'spend' ? '정기적인 비용은 고정 지출에 기록해 주세요.' : '수입은 실제로 받은 날짜에 기록해 주세요.'}</p>
    </Card>
  </div>
}

function LedgerForm({ kind, incomeType, timeZone, row, onDone }: { kind: LedgerKind; incomeType: 'fixed' | 'other'; timeZone: string; row?: LedgerRow; onDone: (date?: string) => void }) {
  const owner = useAuthStore((state) => state.user?.id)
  const sessionKey = useAuthStore((state) => state.sessionKey)
  const [resume] = useState(() => {
    const draft = returnedMemoDraft(owner, kind, kind === 'income' ? incomeType : undefined)
    return draft?.recordId === row?.id ? draft : undefined
  })
  const scope = kind === 'spend' ? 'spend' : incomeType === 'fixed' ? 'fixed-income' : 'other-income'
  const { categories: cats, loading: loadingCategories, failed: categoriesFailed, salaryLabel = '월급' } = useLedgerCategorySettings(scope)
  const [amount, setAmount] = useState(resume?.values.amount ?? String(row?.amount ?? '')), [cat, setCat] = useState(resume?.values.cat ?? row?.cat ?? cats[0]?.name ?? '')
  const [date, setDate] = useState(() => resume?.values.date ?? row?.date ?? new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const memo = row?.memo ?? ''
  const memoId = resume?.memoId ?? row?.memoId, memoTitle = resume?.memoTitle ?? row?.memoTitle
  const [adding, setAdding] = useState(false)
  useEffect(() => rememberLedgerValues(resume, { amount, date, cat }), [resume, amount, date, cat])
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false), client = useQueryClient()
  const selectedCat = cat === row?.cat || cats.some((item) => item.name === cat) ? cat : cats[0]?.name ?? ''
  const categoriesUnavailable = !row && (loadingCategories || categoriesFailed)
  const salaryCategory = kind === 'income' && incomeType === 'fixed' && selectedCat === salaryLabel
  const salary = useQuery({
    queryKey: ['salary-settings', owner, sessionKey],
    queryFn: ({ signal }) => getSalary(signal),
    enabled: salaryCategory && !!owner && !!sessionKey,
    retry: false,
  })
  const salaryRegistered = !!(salary.data?.startMonth || salary.data?.draft)
  const salaryBlocked = salaryCategory && (salary.isPending || salaryRegistered || !!row)
  return <form className={`${styles.quick} ${styles.quickPanel}`} aria-label="수입·기타 지출 기록" onSubmit={async (event) => {
    event.preventDefault(); if (pending.current || categoriesUnavailable || !selectedCat || salaryBlocked) return
    pending.current = true; setBusy(true); setError('')
    try {
      const body = { amount: Number(amount), date, cat: selectedCat, memo, ...(memoId ? { memoId } : {}) }
      if (kind === 'income') await saveLedger(kind, timeZone, { ...body, incomeType }, row?.id)
      else await saveLedger(kind, timeZone, body, row?.id)
      clearMemoDraft(resume)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['ledger'] }),
        ...(salaryCategory ? [client.invalidateQueries({ queryKey: ['salary-settings', owner, sessionKey] })] : []),
      ])
      onDone(date)
    } catch (cause) { setError(getErrorMessage(cause, '저장하지 못했어요.')) }
    finally { pending.current = false; setBusy(false) }
  }}>
    <label className={styles.quickAmount}><AmountInput value={amount} onValueChange={setAmount} max={kind === 'income' ? 999999999 : 99999999} placeholder="0" aria-label="금액 (원)" disabled={busy} /><span>원</span></label>
    <div className={styles.quickCats} role="radiogroup" aria-label="분류">{cats.map((category) => <button type="button" key={category.name} role="radio" aria-checked={selectedCat === category.name} className={`${styles.quickCat} ${selectedCat === category.name ? styles.on : ''}`} disabled={busy} onClick={() => setCat(category.name)}>{category.name}</button>)}</div>
    <Button variant="line" disabled={busy} onClick={() => setAdding(true)}>카테고리 관리</Button>
    <div className={styles.quickFields}><label className={styles.quickField}><span>날짜</span><input type="date" required value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} /></label>
      <button type="button" className={styles.quickField} disabled={busy} onClick={() => {
        if (!owner) return
        openLedgerMemo({ key: resume?.key, owner, kind, incomeType: kind === 'income' ? incomeType : undefined, recordId: row?.id, row, month: date.slice(0, 7), label: `${kind === 'spend' ? '기타 지출' : incomeType === 'fixed' ? '고정 수입' : '기타 수입'} · ${date} · ${selectedCat}`, values: { amount, date, cat: selectedCat }, memoId, memoTitle })
      }}><span>메모 (선택)</span><b>{memoId ? memoTitle?.trim() || '제목 없는 메모' : '메모 작성'}</b></button></div>
    {salaryCategory && <p className={common.note}>{salary.isPending ? '수입 정보를 확인하는 중이에요.' : salaryRegistered || row
      ? <>월급은 <Link to={incomeSettingsPath} className={common.link}>마이페이지 수입 정보</Link>에서 관리해 주세요.</>
      : '첫 월급을 기록하면 이 금액과 수령일을 마이페이지 월 수입에도 저장해요.'}</p>}
    <Button type="submit" block disabled={busy || salaryBlocked || categoriesUnavailable || !selectedCat || !date || !(Number(amount) > 0)}>{busy ? '저장 중' : row ? '저장' : '기록하기'}</Button>
    {row && <Button variant="line" disabled={busy} onClick={async () => {
      try { if (resume) await discardMemoDraft(resume); onDone() }
      catch (cause) { setError(getErrorMessage(cause, '메모를 정리하지 못했어요. 다시 시도해 주세요.')) }
    }}>취소</Button>}
    {error && <p role="alert">{error}</p>}
    {adding && <LedgerCategoryDialog scope={scope} onClose={() => setAdding(false)} onAdded={setCat} onRenamed={(oldName, newName) => { if (selectedCat === oldName) setCat(newName) }} />}
  </form>
}

function DeleteRecord({ kind, row, clearsSalary }: { kind: LedgerKind; row: LedgerRow; clearsSalary: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false), client = useQueryClient()
  return <div><Button variant="line" disabled={busy} onClick={async () => {
    if (pending.current || !window.confirm(clearsSalary ? '이 월급 기록과 마이페이지 수입 정보를 함께 삭제할까요?' : '이 기록을 삭제할까요?')) return
    pending.current = true; setBusy(true); setError('')
    try {
      await deleteLedger(kind, row.id)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['ledger'] }),
        ...(clearsSalary ? [client.invalidateQueries({ queryKey: ['salary-settings'] })] : []),
      ])
    }
    catch (cause) { setError(getErrorMessage(cause, '삭제하지 못했어요.')) }
    finally { pending.current = false; setBusy(false) }
  }}>기록 삭제</Button>{error && <p role="alert">{error}</p>}</div>
}
