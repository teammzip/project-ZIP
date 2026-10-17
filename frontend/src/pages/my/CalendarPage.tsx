import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function CalendarPage() {
  return (
    <PagePlaceholder
      title="일정"
      description="달력, 일정 추가·삭제, 검색"
      legacy={['variants/app/js/views/calendar.js', 'variants/app/css/views/calendar.css']}
    />
  )
}
