import axios from 'axios'
import { isMockApi } from '@/features/auth/api'
import { apiClient } from '@/lib/apiClient'
import type { ChatMsg, SpendCard } from './store'
import type { TopicSuggestion } from './topics'

/* AI 대화 서버 API (frontend/API.md 8장, DB: ai_conversations · ai_messages).
 * 브라우저는 우리 서버에만 묻고 Gemini 키는 서버에만 있어요. */
export type EntryPoint = 'HOME_MODAL' | 'AI_PAGE'
export type AiAnswer = { text: string; kind: 'reply' | 'gemini-quota' | 'unavailable' }

type ServerMessage = { id: string; role: 'USER' | 'ASSISTANT'; text: string; card?: { type: string; data: unknown } }
type ExchangeCard =
  | { type: 'SPEND_SUMMARY'; data: SpendCard }
  | { type: 'LINK'; data: { to: '/ai' } & TopicSuggestion }
  | { type: 'LINK'; data: { to: '/map'; nearbyKeyword: string } }

const toMsg = (m: ServerMessage): ChatMsg => {
  const link = m.card?.type === 'LINK' ? m.card.data as { to?: string; topicId?: unknown; keyword?: unknown; nearbyKeyword?: unknown } | null : null
  return {
    role: m.role === 'USER' ? 'user' : 'bot',
    text: m.text,
    ...(m.card?.type === 'SPEND_SUMMARY' ? { card: m.card.data as SpendCard } : {}),
    ...(link?.to === '/my/budget/expense' ? { billRegistered: true } : {}),
    ...(link?.to === '/ai' && typeof link.topicId === 'string' && typeof link.keyword === 'string'
      ? { suggestion: { topicId: link.topicId, keyword: link.keyword } }
      : {}),
    ...(link?.to === '/map' && typeof link.nearbyKeyword === 'string' ? { nearbyKeyword: link.nearbyKeyword } : {}),
  }
}

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

const AI_UNREACHABLE: AiAnswer = { text: 'AI 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.', kind: 'unavailable' }

/** 서버의 AI 에게 묻기. 질문과 답이 대화방에 저장됨.
 * null 은 모의 API 모드에서만 돌려줘서 데모 답변을 씀. 서버 모드에서 서버에 닿지 못하면(서버 꺼짐 · 대화방을 못 만듦 · 빈 답)
 * 데모 답변으로 바꾸지 않고 연결 실패 안내를 돌려줌 (실제 AI 답처럼 보이는 가짜 답을 막기 위해) */
export async function askAi(conversationId: string | null, text: string, topic?: string): Promise<AiAnswer | null> {
  if (isMockApi) return null
  if (!conversationId) return AI_UNREACHABLE
  try {
    const { data } = await apiClient.post<{ reply: { text: string } }>(`/ai/conversations/${conversationId}/messages`, { text, topic })
    return data.reply?.text ? { text: data.reply.text, kind: 'reply' } : AI_UNREACHABLE
  } catch (error) {
    if (axios.isAxiosError<{ message?: string; code?: string }>(error)) {
      const status = error.response?.status
      const { message, code } = error.response?.data ?? {}
      if (status === 503 && code === 'AI_QUOTA') {
        return { text: message ?? 'AI 사용량을 모두 썼어요. 잠시 뒤 다시 시도해 주세요.', kind: 'gemini-quota' }
      }
      if (status === 429) return { text: message ?? '오늘 질문 한도를 모두 썼어요. 내일 다시 물어봐 주세요.', kind: 'unavailable' }
      if (status === 502 || status === 503) return { text: message ?? 'AI가 지금 답하지 못했어요. 잠시 뒤에 다시 시도해 주세요.', kind: 'unavailable' }
    }
    return AI_UNREACHABLE
  }
}

/** 앱이 직접 답한 질문·답(정해진 분야 · 지출 요약 카드 · 데모 답변)도 같은 대화방에 저장. 실패해도 대화는 계속됨 */
export async function recordExchange(conversationId: string | null, text: string, reply: string, card?: ExchangeCard): Promise<void> {
  if (isMockApi || !conversationId || !text.trim() || !reply.trim()) return
  try {
    await apiClient.post(`/ai/conversations/${conversationId}/exchanges`, { text, reply, card })
  } catch {
    // 저장에 실패해도 화면의 대화는 그대로
  }
}

/** 대화 목록 한 줄 (GET /api/ai/conversations). title = 첫 질문 요약, 질문 없이 만든 대화는 null */
export type ConversationSummary = { id: string; title: string | null; topic: string | null; entryPoint: EntryPoint; updatedAt: string }

/** 내 AI 대화 목록 (홈 · AI 화면 모두, 최근 20개). 모의 API 모드는 서버에 저장하지 않아 빈 목록 */
export async function listConversations(): Promise<ConversationSummary[]> {
  if (isMockApi) return []
  return (await apiClient.get<ConversationSummary[]>('/ai/conversations')).data
}

/** 대화 한 건 삭제 (DELETE /api/ai/conversations/{id}). 실패하면 오류를 그대로 던져서 화면이 안내해요 */
export async function deleteConversation(id: string): Promise<void> {
  if (isMockApi) return
  await apiClient.delete(`/ai/conversations/${encodeURIComponent(id)}`)
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
