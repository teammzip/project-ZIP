import axios from 'axios'
import { isMockApi } from '@/features/auth/api'
import { apiClient } from '@/lib/apiClient'
import type { ChatMsg, SpendCard } from './store'

/* AI 대화 서버 API (frontend/API.md 8장, DB: ai_conversations · ai_messages).
 * 브라우저는 우리 서버에만 묻고 Gemini 키는 서버에만 있어요. 가짜 API 모드이거나 서버를 쓸 수 없으면 모두 null 로 돌려줘서
 * 부른 쪽이 예전처럼 브라우저 안의 데모 답변으로 이어가요. */
export type EntryPoint = 'HOME_MODAL' | 'AI_PAGE'
export type AiAnswer = { text: string; /** 하루 질문 한도를 넘었다는 안내 문구 (저장되지 않음) */ limited?: boolean }

type ServerMessage = { id: string; role: 'USER' | 'ASSISTANT'; text: string; card?: { type: string; data: unknown } }

const toMsg = (m: ServerMessage): ChatMsg => ({
  role: m.role === 'USER' ? 'user' : 'bot',
  text: m.text,
  ...(m.card?.type === 'SPEND_SUMMARY' ? { card: m.card.data as SpendCard } : {}),
})

/** 새 대화방을 만들고 id 를 돌려줌 */
export async function createConversation(entryPoint: EntryPoint, topic?: string): Promise<string | null> {
  if (isMockApi) return null
  try {
    const { data } = await apiClient.post<{ id: string }>('/ai/conversations', { entryPoint, topic: topic ?? null })
    return data.id
  } catch {
    return null
  }
}

/** 가장 최근 대화방과 그 말풍선 (없으면 null) */
export async function loadLatestConversation(entryPoint: EntryPoint): Promise<{ id: string; msgs: ChatMsg[] } | null> {
  if (isMockApi) return null
  try {
    const list = await apiClient.get<Array<{ id: string }>>('/ai/conversations', { params: { entryPoint } })
    const latest = list.data[0]
    if (!latest) return null
    const messages = await apiClient.get<ServerMessage[]>(`/ai/conversations/${latest.id}/messages`)
    return { id: latest.id, msgs: messages.data.map(toMsg) }
  } catch {
    return null
  }
}

/** 서버의 AI 에게 묻기. 질문과 답이 대화방에 저장됨. null 이면 서버에 닿지 못한 상태(로그인 만료 · 서버 꺼짐)라서 데모 답변을 씀 */
export async function askAi(conversationId: string | null, text: string, topic?: string): Promise<AiAnswer | null> {
  if (isMockApi || !conversationId) return null
  try {
    const { data } = await apiClient.post<{ reply: { text: string } }>(`/ai/conversations/${conversationId}/messages`, { text, topic })
    return data.reply.text ? { text: data.reply.text } : null
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const message = (error.response?.data as { message?: string } | undefined)?.message
      if (status === 429) return { text: message ?? '오늘 질문 한도를 모두 썼어요. 내일 다시 물어봐 주세요.', limited: true }
      // AI 쪽 문제(사용량 소진 · 일시 오류 · 준비 안 됨)는 데모 답변으로 속이지 않고 그대로 알려 줌
      if (status === 502 || status === 503) return { text: message ?? 'AI가 지금 답하지 못했어요. 잠시 뒤에 다시 시도해 주세요.', limited: true }
    }
    return null
  }
}

/** 앱이 직접 답한 질문·답(정해진 분야 · 지출 요약 카드 · 데모 답변)도 같은 대화방에 저장. 실패해도 대화는 계속됨 */
export async function recordExchange(conversationId: string | null, text: string, reply: string, card?: SpendCard): Promise<void> {
  if (isMockApi || !conversationId || !text.trim() || !reply.trim()) return
  try {
    await apiClient.post(`/ai/conversations/${conversationId}/exchanges`, { text, reply, card: card ? { type: 'SPEND_SUMMARY', data: card } : undefined })
  } catch {
    // 저장에 실패해도 화면의 대화는 그대로
  }
}

/** 내 AI 대화를 모두 지움 (데이터 초기화) */
export async function deleteAllConversations(): Promise<void> {
  if (isMockApi) return
  try {
    await apiClient.delete('/ai/conversations')
  } catch {
    // 서버에 닿지 않으면 다음에 다시 시도해도 됨
  }
}
