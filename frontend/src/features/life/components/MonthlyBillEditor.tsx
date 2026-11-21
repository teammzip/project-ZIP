import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AmountInput, Button } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { deleteMonthlyBill, registerMonthlyBill, updateMonthlyBill, type ServerBill } from '../billsApi'
import { useLedgerCategorySettings } from '../ledgerCategories'
import { LedgerCategoryDialog } from './LedgerCategoryDialog'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import styles from './life.module.css'
import { useAuthStore } from '@/features/auth'
import { returnedMemoDraft, openLedgerMemo, clearMemoDraft } from '../ledgerMemoNavigation'

function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map((part) => parts.find((value) => value.type === part)?.value).join('-')
}

type Props = { month: string; timeZone: string; bill?: ServerBill }
export function MonthlyBillEditor({ month, timeZone, bill }: Props) {
  const client = useQueryClient()
  const owner = useAuthStore((state) => state.user?.id)
  const [resume, setResume] = useState(() => {
    const draft = returnedMemoDraft(owner, 'bill')
    return draft?.recordId === bill?.id && draft?.month === month ? draft : undefined
  })
  const [editing, setEditing] = useState(!!resume || !bill)
  const { categories, loading: loadingCategories, failed: categoriesFailed } = useLedgerCategorySettings('bill')
  const [addingCategory, setAddingCategory] = useState(false)
  const [tag, setTag] = useState(resume?.values.tag ?? bill?.tag ?? '공과금')
  const selectedTag = categories.some((item) => item.name === tag) ? tag : categories[0]?.name ?? ''
  const categoryUnavailable = !bill && (loadingCategories || categoriesFailed || !selectedTag)
  const [amount, setAmount] = useState(resume?.values.amount ?? String(bill?.amount ?? ''))
  const [dueDate, setDueDate] = useState(resume?.values.dueDate ?? bill?.dueDate ?? '')
  const [memo, setMemo] = useState(bill?.memo ?? '')
  const memoId = resume?.memoId ?? bill?.memoId, memoTitle = resume?.memoTitle ?? bill?.memoTitle
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [today, setToday] = useState(() => localDate(timeZone))
  useEffect(() => {
    const refresh = () => setToday(localDate(timeZone))
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [timeZone])
  const keepingDeadline = !!bill?.snapshot && dueDate === bill.dueDate
  const run = async (task: () => Promise<ServerBill>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      const saved = await task()
      clearMemoDraft(resume)
      setResume(undefined)
      setEditing(!bill)
      if (!bill) { setAmount(''); setMemo(''); setDueDate('') }
      setNotice(`${saved.name} · ${saved.amount.toLocaleString('ko-KR')}원 · 납부 기한 ${saved.dueDate} 저장 완료`)
      await client.invalidateQueries({ queryKey: ['monthly-bills'] })
    } catch (e) { setError(getErrorMessage(e, '저장하지 못했어요. 다시 시도해 주세요.')) }
    finally { pending.current = false; setBusy(false) }
  }
  const save = () => {
    if (categoryUnavailable) return
    if (dueDate && dueDate < localDate(timeZone) && !keepingDeadline) { setError('납부 기한은 오늘 이후로 입력해 주세요.'); return }
    if (!/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount)) || !dueDate || (!bill && !selectedTag)) {
      setError('분류·원 단위 정수 금액·납부 기한을 확인해 주세요.'); return
    }
    if (bill?.snapshot) void run(() => updateMonthlyBill(bill.id, month, timeZone, { amount: Number(amount), dueDate, memo, ...(memoId ? { memoId } : {}) }))
    else void run(() => registerMonthlyBill(month, timeZone, { ...(bill ? { name: bill.name } : {}), tag: bill?.tag ?? selectedTag, amount: Number(amount), dueDate, memo, ...(memoId ? { memoId } : {}) }))
  }
  const remove = async () => {
    if (pending.current || !bill?.snapshot || bill.paid || !window.confirm(`${month} 기록만 삭제할까요? 다른 달의 기록과 정기 지출은 유지됩니다. 반복 지출을 중단하려면 정기 지출 해지를 이용해 주세요.`)) return
    pending.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      await deleteMonthlyBill(bill.id, month, timeZone)
      await client.invalidateQueries({ queryKey: ['monthly-bills'] })
    } catch (e) { setError(getErrorMessage(e, '삭제하지 못했어요. 다시 시도해 주세요.')) }
    finally { pending.current = false; setBusy(false) }
  }
  const begin = () => {
    setAmount(String(bill?.amount ?? '')); setDueDate(bill?.dueDate ?? '')
    setMemo(bill?.memo ?? '')
    setError(''); setNotice(''); setEditing(true)
  }
  return <div className={styles.monthlyEditor}>
    {!editing && <Button variant="line" onClick={begin} disabled={busy}>{bill ? bill.snapshot ? '수정' : '등록' : '직접 등록'}</Button>}
    {!editing && bill?.snapshot && !bill.paid && <Button variant="line" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중' : '이번 달 기록 삭제'}</Button>}
    {editing && <form className={cx(styles.quick, styles.quickPanel)} onSubmit={(e) => { e.preventDefault(); save() }} aria-label="고정 지출 기록하기">
      {!bill && <label className={styles.quickAmount}><AmountInput value={amount} max={9007199254740991} onValueChange={setAmount} placeholder="0" aria-label="금액 (원)" disabled={busy} /><span>원</span></label>}
      {!bill && <>
        <div className={styles.quickCats} role="radiogroup" aria-label="고정 지출 분류">{categories.map((category) => <button key={category.name} type="button" role="radio" aria-checked={selectedTag === category.name} className={cx(styles.quickCat, selectedTag === category.name && styles.on)} disabled={busy} onClick={() => setTag(category.name)}>{category.name}</button>)}</div>
        <Button variant="line" disabled={busy} onClick={() => setAddingCategory(true)}>카테고리 관리</Button>
      </>}
      {bill && <label className={styles.quickField}>금액(원)<input type="number" min="0" max="9007199254740991" step="1" required value={amount} disabled={busy} onChange={(e) => setAmount(e.target.value)} /></label>}
      <div className={styles.quickFields}>
        <label className={styles.quickField}><span>납부 기한</span><input className={styles.quickDate} type="date" min={keepingDeadline ? undefined : today} max="9999-12-31" required value={dueDate} disabled={busy} onChange={(e) => setDueDate(e.target.value)} /></label>
        <button type="button" className={styles.quickField} disabled={busy} aria-label="메모 작성" onClick={() => {
          if (!owner) return
          openLedgerMemo({ key: resume?.key, owner, kind: 'bill', recordId: bill?.id, month, label: `고정 지출 · ${month} · ${bill?.name ?? selectedTag}`, values: { amount, dueDate, tag: selectedTag }, memoId, memoTitle })
        }}><span>메모 (선택)</span><b className={styles.quickAdd}>{memoId ? memoTitle?.trim() || '제목 없는 메모' : '메모 작성'}</b></button>
      </div>
      <Button type="submit" block disabled={busy || !amount || !dueDate || categoryUnavailable}>{busy ? '저장 중' : bill ? '저장' : '기록하기'}</Button>
      {bill && <Button type="button" variant="line" disabled={busy} onClick={() => { setEditing(false); setError('') }}>취소</Button>}
    </form>}
    {addingCategory && <LedgerCategoryDialog scope="bill" onClose={() => setAddingCategory(false)} onAdded={setTag} onRenamed={(oldName, newName) => { if (selectedTag === oldName) setTag(newName) }} />}
    {error && <p role="alert" className={common.formError}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </div>
}
