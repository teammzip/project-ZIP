import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui'
import { monthKeyOf, todayStr, won } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { spendBreakdown, sumAmount, useNotis } from '../derive'
import { useLifeStore } from '../store'
import styles from './myinfo.module.css'

/* 내 정보 화면에 쓰는 생활 조각들: 수입·지출 카드, 이번 달 요약, 생활 정보 폼, 알림 스위치 */

/** 이번 달 수입·지출 카드. 홈과 같은 기준으로 합산하고 가계부로 연결. */
export function BudgetSummaryCard() {
  const { incomes, spends, bills, settings } = useLifeStore(useShallow((s) => ({ incomes: s.incomes, spends: s.spends, bills: s.bills, settings: s.settings })))
  const month = todayStr().slice(0, 7)
  const income = sumAmount(incomes.filter((r) => r.date.slice(0, 7) === month))
  const expense = spendBreakdown(0, spends, bills, settings).total
  return (
    <Link to="/my/budget" className={styles.budget}>
      <strong>이번 달 수입·지출</strong>
      <dl className={styles.budgetTotals}>
        <div><dt>총수입</dt><dd>{won(income)}</dd></div>
        <div><dt>총지출</dt><dd>{won(expense)}</dd></div>
      </dl>
      <small>월세·공과금·기타 지출 포함</small>
      <span className={styles.budgetLink}>가계부 보기 →</span>
    </Link>
  )
}

/** 이번 달 요약 카드 4개. 커뮤니티 글 수는 다른 기능이라 쓰는 쪽이 넘겨 줌 */
export function LifeStats({ postCount }: { postCount: number }) {
  const { events, bills } = useLifeStore(useShallow((s) => ({ events: s.events, bills: s.bills })))
  const { unread } = useNotis()
  const notiOn = useLifeStore((s) => s.settings.notiOn)
  const month = monthKeyOf(useToday())
  const paid = bills.length ? Math.round((bills.filter((b) => b.paidMonth === month).length / bills.length) * 100) : 0
  const items = [
    { to: '/my/calendar', label: '이번 달 일정', value: `${events.filter((e) => e.date.startsWith(month)).length}개` },
    { to: '/my/budget/expense', label: '공과금 납부', value: `${paid}%` },
    { to: '/my/noti', label: '안 읽은 알림', value: `${notiOn ? unread : 0}개` },
    { to: '/community', label: '내가 쓴 글', value: `${postCount}개` },
  ]
  return (
    <section className={styles.stats} aria-label="이번 달 요약">
      {items.map((it) => (
        <Link key={it.label} to={it.to} className={styles.stat}>
          <small>{it.label}</small>
          <b>{it.value}</b>
        </Link>
      ))}
    </section>
  )
}

/** 생활 정보 폼: 우리 동네, 월세 납부일·금액, 입주한 달, 계약 끝나는 달 */
export function LifeInfoForm({ onSaved }: { onSaved?: () => void }) {
  const settings = useLifeStore((s) => s.settings)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  const [form, setForm] = useState({
    region: settings.region,
    rentDay: String(settings.rentDay),
    rent: String(settings.rent),
    moveIn: settings.moveIn,
    contractEnd: settings.contractEnd,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    saveSettings({
      ...settings,
      region: form.region.trim(),
      rentDay: Math.min(31, Math.max(1, Number(form.rentDay) || 15)),
      rent: Math.max(0, Number(form.rent) || 0),
      moveIn: form.moveIn || settings.moveIn,
      contractEnd: form.contractEnd || settings.contractEnd,
    })
    onSaved?.()
  }

  return (
    <form className={common.form} onSubmit={submit}>
      <label>
        우리 동네
        <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} maxLength={30} placeholder="예) 서울 마포구" />
      </label>
      <div className={common.two}>
        <label>
          월세 납부일 (매월)
          <input type="number" value={form.rentDay} onChange={(e) => setForm({ ...form, rentDay: e.target.value })} min={1} max={31} required />
        </label>
        <label>
          월세 (만원)
          <input type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} min={0} max={9999} required />
        </label>
      </div>
      <div className={common.two}>
        <label>
          입주한 달
          <input type="month" value={form.moveIn} onChange={(e) => setForm({ ...form, moveIn: e.target.value })} />
        </label>
        <label>
          계약 끝나는 달
          <input type="month" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} />
        </label>
      </div>
      <Button type="submit" block>
        저장
      </Button>
    </form>
  )
}

/** 알림 받기 스위치: 누르면 바로 저장 */
export function NotiSwitch({ onChange }: { onChange?: (on: boolean) => void }) {
  const settings = useLifeStore((s) => s.settings)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  return (
    <input
      type="checkbox"
      className={styles.switch}
      checked={settings.notiOn}
      aria-label="알림 받기"
      onChange={(e) => {
        saveSettings({ ...settings, notiOn: e.target.checked })
        onChange?.(e.target.checked)
      }}
    />
  )
}
