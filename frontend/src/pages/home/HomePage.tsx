import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function HomePage() {
  return (
    <PagePlaceholder
      title="홈"
      description="사진 상담 카드, 요약 카드, 차트, 꿀팁, AI와 대화 카드"
      legacy={['variants/app/js/views/dashboard.js', 'variants/app/css/views/dashboard.css', 'variants/app/js/components/ai-chat.js']}
    />
  )
}
