import { AiChat } from './AiChat'
import { useAuthStore } from '@/features/auth'

type Props = {
  region: string
  name: string
}

/** AI 도우미(데모): 채팅 화면 하나로 PC·모바일 모두 같음.
 * 위는 대화, 아래에 분야 카드 → 입력줄(＋ 로 카메라·사진 고르기). 예전 '사진' 메뉴는 여기로 합쳐짐 */
export function AiAssistant(props: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const token = useAuthStore((s) => s.token)
  return <AiChat key={`${userId}:${token}`} {...props} />
}
