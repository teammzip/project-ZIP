import { MoneyLog } from '@/features/life'
import { useLocation } from 'react-router-dom'
import { TabNav } from '@/components/ui'
import common from '@/styles/common.module.css'

export function IncomePage() {
  const incomeType = useLocation().pathname.endsWith('/other') ? 'other' : 'fixed'
  return (
    <div className={common.stack}>
      <TabNav items={[
        { to: '/my/budget/income', label: '고정 수입', end: true },
        { to: '/my/budget/income/other', label: '기타 수입' },
      ]} label="수입 종류" variant="chip" />
      <MoneyLog key={incomeType} kind="income" incomeType={incomeType} />
    </div>
  )
}
