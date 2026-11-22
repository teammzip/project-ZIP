import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { POLICY, PRIVACY, TERMS, type LegalDoc } from './content'

/* 약관 (frontend/API.md 10장). 서버 모드는 GET /api/terms(로그인 없이 볼 수 있음)의 지금 시행 중인 약관을 보여 주고,
 * 불러오는 중 · 실패 · 목업 모드에서는 content.ts 의 같은 문구를 보여 줘요. */

export type LegalKind = 'SERVICE' | 'PRIVACY' | 'POLICY'

type ServerTerm = { docType: LegalKind; version: string; title: string; content: string; consentKind: string; required: boolean }

const LOCAL: Record<LegalKind, LegalDoc> = { SERVICE: TERMS, PRIVACY, POLICY }

/** "2026-10-18" → "2026. 10. 18. 시행" */
const updatedText = (version: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version)
  return m ? `${m[1]}. ${m[2]}. ${m[3]}. 시행` : `${version} 시행`
}

/** 서버 약관 본문(빈 줄로 조항 구분, 조항 첫 줄 = 제목) → 화면 모양 */
export function toLegalDoc(term: Pick<ServerTerm, 'title' | 'version' | 'content'>): LegalDoc {
  const sections = term.content.replace(/\r\n/g, '\n').split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map(([title, ...body]) => ({ title, body }))
  return { title: term.title, updated: updatedText(term.version), sections }
}

/** 지금 시행 중인 약관 하나 (서버 · 화면 문구 중 쓸 수 있는 것) */
export function useLegalDoc(kind: LegalKind): LegalDoc {
  const server = useQuery({
    queryKey: ['terms'],
    queryFn: async () => (await apiClient.get<ServerTerm[]>('/terms')).data,
    enabled: !isMockApi,
    staleTime: 60 * 60_000,
    retry: 1,
  })
  const term = server.data?.find((t) => t.docType === kind)
  return term?.content ? toLegalDoc(term) : LOCAL[kind]
}
