import { useProfile } from '@/app/useProfile'
import { AiAssistant } from '@/features/ai'

/* AI 도우미: 분야 선택 → 질문 초안 → 답변 (사진 첨부 가능) */
export function AiPage() {
  const { name, region } = useProfile()
  return <AiAssistant name={name} region={region} />
}
