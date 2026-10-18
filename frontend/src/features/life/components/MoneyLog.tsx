import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card } from '@/components/ui'
import { cssVar } from '@/lib/cssVar'
import { cx } from '@/lib/cx'
import { DOW, monthKeyOf, monthLabel, todayStr, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { INCOME_CATS, SPEND_CATS, type Category } from '../data/catalog'
import { useLifeStore } from '../store'
import styles from './life.module.css'

type Kind = 'income' | 'spend'

const TEXT: Record<Kind, { title: string; topLabel: string; formTitle: string; catLabel: string; memoPh: string; empty: string; note: string; max: number }> = {
  income: {
    title: '수입',
    topLabel: '가장 큰 수입',
    formTitle: '수입 기록하기',
    catLabel: '수입 종류',
    memoPh: '예) 주말 카페 알바, 중고거래',
    empty: '이 달에는 수입 기록이 없어요. 오른쪽에서 첫 수입을 기록해 보세요.',
    note: '쓴 돈은 "지출" 탭에 있어요.',
    max: 999999999,
  },
  spend: {
    title: '기타 지출',
    topLabel: '가장 많이 쓴 곳',
    formTitle: '지출 기록하기',
    catLabel: '분류',
    memoPh: '예) 점심 김밥, 세제',
    empty: '이 달에는 기록이 없어요. 오른쪽에서 첫 지출을 기록해 보세요.',
    note: '월세·공과금은 "고정 지출"에 따로 있어요.',
    max: 99999999,
  },
}

const colorOf = (cats: Category[], name: string) => cats.find((c) => c.name === name)?.color ?? 'var(--color-muted)'

/** 수입 · 기타 지출 기록: 월별 보기, 분류별 합계, 기록 추가 · 삭제 (두 화면이 모양이 같아서 하나로 씀) */
export function MoneyLog({ kind }: { kind: Kind }) {
  const t = TEXT[kind]
  const cats = kind === 'income' ? INCOME_CATS : SPEND_CATS
  const { records, add, remove } = useLifeStore(
    useShallow((s) =>
      kind === 'income'
        ? { records: s.incomes, add: s.addIncome, remove: s.removeIncome }
        : { records: s.spends, add: s.addSpend, remove: s.removeSpend },
    ),
  )
  const thisMonth = monthKeyOf(useToday())
  const [monthKey, setMonthKey] = useState(thisMonth)
  const [form, setForm] = useState({ date: todayStr(), cat: cats[0].name, amount: '', memo: '' })

  // 월 선택: 기록이 있는 달 + 이번 달 (최근 달이 위로)
  const months = [...new Set([thisMonth, ...records.map((r) => r.date.slice(0, 7))])].sort().reverse()
  const rows = records
    .filter((r) => r.date.slice(0, 7) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const byCat: Record<string, number> = {}
  for (const r of rows) byCat[r.cat] = (byCat[r.cat] ?? 0) + r.amount
  const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const amount = Math.round(Number(form.amount))
    if (!form.date || !(amount > 0)) return
    add({ date: form.date, cat: form.cat, amount, memo: form.memo.trim() })
    setMonthKey(form.date.slice(0, 7)) // 기록한 날짜의 달로 이동해서 바로 보이게
    setForm((f) => ({ ...f, amount: '', memo: '' }))
  }

  return (
    <div className={common.layout}>
      <Card
        title={`${Number(monthKey.slice(5))}월 ${t.title}`}
        actions={
          <select className={common.select} value={monthKey} onChange={(e) => setMonthKey(e.target.value)} aria-label="월 선택">
            {months.map((k) => (
              <option key={k} value={k}>
                {monthLabel(k)}
              </option>
            ))}
          </select>
        }
      >
        <div className={common.sumRow}>
          <div>
            <small>합계</small>
            <b>{won(total)}</b>
          </div>
          <div>
            <small>기록</small>
            <b>{rows.length}건</b>
          </div>
          <div>
            <small>{t.topLabel}</small>
            <b>{topCat ? `${topCat} ${Math.round((byCat[topCat] / total) * 100)}%` : '-'}</b>
          </div>
        </div>

        <div className={styles.catChips}>
          {cats
            .filter((c) => byCat[c.name])
            .map((c) => (
              <span key={c.name} className={common.dotChip} style={cssVar({ '--c': c.color })}>
                {c.name} {won(byCat[c.name])}
              </span>
            ))}
        </div>

        {rows.map((r) => {
          const d = new Date(`${r.date}T00:00:00`)
          const name = r.memo || r.cat
          return (
            <div key={r.id} className={styles.moneyRow}>
              <div className={styles.moneyDate}>
                <b>{d.getDate()}</b>
                <small>{DOW[d.getDay()]}</small>
              </div>
              <div className={styles.moneyInfo}>
                <b>{name}</b>
                <span className={cx(common.dotChip, common.dotChipSmall)} style={cssVar({ '--c': colorOf(cats, r.cat) })}>
                  {r.cat}
                </span>
              </div>
              <div className={cx(styles.moneyAmt, kind === 'income' && styles.plus)}>
                {kind === 'income' ? '+' : ''}
                {won(r.amount)}
              </div>
              <button type="button" className={common.del} onClick={() => remove(r.id)} aria-label={`${name} 기록 삭제`} title="삭제">
                ×
              </button>
            </div>
          )
        })}
        {!rows.length && <p className={common.empty}>{t.empty}</p>}
      </Card>

      <Card title={t.formTitle}>
        <form className={common.form} onSubmit={submit}>
          <div className={common.two}>
            <label>
              날짜
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label>
              {t.catLabel}
              <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                {cats.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            금액 (원)
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} min={1} max={t.max} required />
          </label>
          <label>
            메모 (선택)
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} maxLength={30} placeholder={t.memoPh} />
          </label>
          <Button type="submit" block>
            기록하기
          </Button>
        </form>
        <p className={common.note}>{t.note}</p>
      </Card>
    </div>
  )
}
