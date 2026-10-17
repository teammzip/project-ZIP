import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function AiPage() {
  return (
    <PagePlaceholder
      title="AI 도우미"
      description="분야 선택 → 질문 초안 → 답변, 사진 첨부"
      legacy={['variants/app/js/views/ai.js', 'variants/app/css/views/ai.css']}
    />
  )
}
