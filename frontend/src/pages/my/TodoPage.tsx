import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function TodoPage() {
  return (
    <PagePlaceholder
      title="할 일"
      description="이번 주 할 일 | 쓰레기 배출"
      legacy={['variants/app/js/views/todo.js', 'variants/app/js/views/trash.js', 'variants/app/js/data/trash.js']}
    />
  )
}
