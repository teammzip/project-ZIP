import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card } from '@/components/ui'
import { cssVar } from '@/lib/cssVar'
import { cx } from '@/lib/cx'
import { DOW, monthKeyOf, monthLabel, todayStr, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { FIXED_INCOME_CATS, OTHER_INCOME_CATS, SPEND_CATS, type Category } from '../data/catalog'
import { useLifeStore } from '../store'
import type { IncomeType, MoneyRecord } from '../types'
import styles from './life.module.css'

type Kind = 'income' | 'spend'

const TEXT: Record<Kind, { title: string; topLabel: string; formTitle: string; quickTitle: string; catLabel: string; memoPh: string; empty: string; note: string; max: number }> = {
  income: {
    title: '수입',
    topLabel: '',
    formTitle: '수입 기록하기',
    quickTitle: '💰 얼마 받았어요?',
    catLabel: '수입 종류',
    memoPh: '예) 주말 카페 알바, 중고거래',
    empty: '이 달에는 수입 기록이 없어요. 첫 수입을 기록해 보세요.',
    note: '쓴 돈은 "지출" 탭에 있어요.',
    max: 999999999,
  },
  spend: {
    title: '기타 지출',
    topLabel: '가장 많이 쓴 곳',
    formTitle: '지출 기록하기',
    quickTitle: '💸 얼마 썼어요?',
    catLabel: '분류',
    memoPh: '예) 점심 김밥, 세제',
    empty: '이 달에는 기록이 없어요. 첫 지출을 기록해 보세요.',
    note: '월세·공과금은 "고정 지출"에 따로 있어요.',
    max: 99999999,
  },
}

const colorOf = (cats: Category[], name: string) => cats.find((c) => c.name === name)?.color ?? 'var(--color-muted)'

/** 수입 · 기타 지출 기록: 월별 보기, 분류별 합계, 기록 추가 · 삭제 (두 화면이 모양이 같아서 하나로 씀)
 * - PC: 왼쪽 목록 · 그래프, 오른쪽 기록하기 폼
 * - 모바일: 합계 · 그래프 아래 "+ ○○ 기록하기" → 누르면 그 자리에 빠른 기록(금액 크게 · 종류 칩 · 날짜 · 메모는 작게) → 아래 목록 */
export function MoneyLog({ kind, incomeType = 'fixed' }: { kind: Kind; incomeType?: IncomeType }) {
  const incomeTitle = incomeType === 'fixed' ? '고정 수입' : '기타 수입'
  const t = kind === 'income' ? {
    ...TEXT.income,
    title: incomeTitle,
    formTitle: `${incomeTitle} 기록하기`,
    memoPh: incomeType === 'fixed' ? '예) 월급, 예금 이자' : '예) 주말 카페 알바, 부모님 용돈',
    empty: `이 달에는 ${incomeTitle} 기록이 없어요. 첫 수입을 기록해 보세요.`,
    note: incomeType === 'fixed' ? '월급·이자 등 정기적으로 들어오는 수입을 받은 날짜에 기록해요.' : '부수입·용돈 등 일정하지 않은 수입을 기록해요.',
  } : TEXT.spend
  const cats = kind === 'income' ? (incomeType === 'fixed' ? FIXED_INCOME_CATS : OTHER_INCOME_CATS) : SPEND_CATS
  const { records, add, remove } = useLifeStore(
    useShallow((s) =>
      kind === 'income'
        ? { records: s.incomes, add: s.addIncome, remove: s.removeIncome }
        : { records: s.spends, add: s.addSpend, remove: s.removeSpend },
    ),
  )
  // 분류가 없던 기존 기록도 보존: 월급·이자 등은 고정, 나머지는 기타 수입.
  const visibleRecords = kind === 'income' ? records.filter((r: MoneyRecord) =>
    (r.incomeType ?? (FIXED_INCOME_CATS.some((c) => c.name === r.cat) ? 'fixed' : 'other')) === incomeType,
  ) : records
  const thisMonth = monthKeyOf(useToday())
  const [monthKey, setMonthKey] = useState(thisMonth)
  const [form, setForm] = useState({ date: todayStr(), cat: cats[0].name, amount: '', memo: '' })
  const [memoOpen, setMemoOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [saved, setSaved] = useState('')

  // 월 선택: 기록이 있는 달 + 이번 달 (최근 달이 위로)
  const months = [...new Set([thisMonth, ...visibleRecords.map((r) => r.date.slice(0, 7))])].sort().reverse()
  const rows = visibleRecords
    .filter((r) => r.date.slice(0, 7) === monthKey)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const byCat: Record<string, number> = {}
  for (const r of rows) byCat[r.cat] = (byCat[r.cat] ?? 0) + r.amount
  // 분류별 비율 원형 그래프 (큰 분류부터 시계 방향)
  const catRows = cats.filter((c) => byCat[c.name]).sort((a, b) => byCat[b.name] - byCat[a.name])
  const stops: string[] = []
  catRows.reduce((from, c) => {
    const to = from + (byCat[c.name] / total) * 100
    stops.push(`${c.color} ${from}% ${to}%`)
    return to
  }, 0)
  const topCat = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a])[0]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const amount = Math.round(Number(form.amount))
    if (!form.date || !(amount > 0)) return
    add({ date: form.date, cat: form.cat, amount, memo: form.memo.trim(), ...(kind === 'income' ? { incomeType } : {}) })
    setMonthKey(form.date.slice(0, 7)) // 기록한 날짜의 달로 이동해서 바로 보이게
    setForm((f) => ({ ...f, amount: '', memo: '' }))
    setMemoOpen(false)
    setQuickOpen(false)
    setSaved(`✅ ${form.cat} ${won(amount)} 기록했어요`)
  }

  /** 빠른 기록 폼 (panel = PC 오른쪽 카드 안, 아니면 모바일 그래프 아래 펼침) */
  const quickForm = (panel: boolean) => (
    <form className={cx(styles.quick, panel ? styles.quickPanel : styles.quickInline)} onSubmit={submit} aria-label={t.formTitle}>
      {!panel && (
        <div className={styles.quickHead}>
          <b className={styles.quickTitle}>{t.quickTitle}</b>
          <button type="button" className={styles.quickX} onClick={() => setQuickOpen(false)} aria-label="기록 닫기">
            ✕
          </button>
        </div>
      )}
      <label className={styles.quickAmount}>
        <input
          inputMode="numeric"
          value={form.amount ? Number(form.amount).toLocaleString('ko-KR') : ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, String(t.max).length)
            setForm({ ...form, amount: digits && String(Math.min(Number(digits), t.max)) })
            setSaved('')
          }}
          placeholder="0"
          aria-label="금액 (원)"
        />
        <span>원</span>
      </label>
      <div className={styles.quickCats} role="radiogroup" aria-label={t.catLabel}>
        {cats.map((c) => (
          <button
            key={c.name}
            type="button"
            role="radio"
            aria-checked={form.cat === c.name}
            className={cx(styles.quickCat, form.cat === c.name && styles.on)}
            style={cssVar({ '--c': c.color })}
            onClick={() => setForm({ ...form, cat: c.name })}
          >
            {c.name}
          </button>
        ))}
      </div>
      {/* 날짜 · 메모: 입력칸 모양 두 칸 나란히 */}
      <div className={styles.quickFields}>
        <label className={styles.quickField}>
          <span>날짜</span>
          <input
            type="date"
            className={styles.quickDate}
            value={form.date}
            required
            onChange={(e) => {
              setForm((f) => ({ ...f, date: e.target.value }))
              setSaved('')
            }}
            aria-label="날짜"
          />
        </label>
        {memoOpen ? (
          <label className={styles.quickField}>
            <span>메모</span>
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} maxLength={30} placeholder={t.memoPh.replace('예) ', '')} aria-label="메모" autoFocus />
          </label>
        ) : (
          <button type="button" className={styles.quickField} onClick={() => setMemoOpen(true)}>
            <span>메모 (선택)</span>
            <b className={styles.quickAdd}>📝 메모 추가</b>
          </button>
        )}
      </div>
      <Button type="submit" block disabled={!(Number(form.amount) > 0)}>
        기록하기
      </Button>
      {panel && saved && (
        <p className={styles.quickSaved} role="status">
          {saved}
        </p>
      )}
    </form>
  )

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
          {t.topLabel && (
            <div>
              <small>{t.topLabel}</small>
              <b>{topCat ? `${topCat} ${Math.round((byCat[topCat] / total) * 100)}%` : '-'}</b>
            </div>
          )}
        </div>

        {total > 0 && (
          <div className={styles.moneyDonutWrap}>
            <div className={styles.moneyDonut} style={{ background: `conic-gradient(${stops.join(', ')})` }} role="img" aria-label={`${t.title} 합계 ${won(total)}`}>
              <div className={styles.moneyDonutCenter}>
                <small>총 {kind === 'income' ? '수입' : '지출'}</small>
                <b>{won(total)}</b>
              </div>
            </div>
            <ul className={styles.moneyLegend}>
              {catRows.map((c) => (
                <li key={c.name} style={cssVar({ '--c': c.color })}>
                  {c.name}
                  <span>
                    {Math.round((byCat[c.name] / total) * 100)}% · {won(byCat[c.name])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 모바일: 그래프 아래 "+ ○○ 기록하기" → 누르면 그 자리에 빠른 기록 */}
        {quickOpen ? (
          quickForm(false)
        ) : (
          <>
            <button type="button" className={styles.quickOpen} onClick={() => setQuickOpen(true)}>
              ＋ {t.formTitle}
            </button>
            {saved && (
              <p className={cx(styles.quickSaved, styles.quickSavedOut)} role="status">
                {saved}
              </p>
            )}
          </>
        )}

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

      <Card title={t.formTitle} className={styles.fullForm}>
        {quickForm(true)}
        <p className={common.note}>{t.note}</p>
      </Card>
    </div>
  )
}
