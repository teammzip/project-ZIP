import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function BudgetPage() {
  return (
    <PagePlaceholder
      title="가계부"
      description="수입 | 지출(고정 지출: 월세 + 공과금 / 기타 지출)"
      legacy={['variants/app/js/views/income.js', 'variants/app/js/views/spend.js', 'variants/app/js/views/fixed.js', 'variants/app/js/views/rent.js', 'variants/app/js/views/bills.js']}
    />
  )
}
