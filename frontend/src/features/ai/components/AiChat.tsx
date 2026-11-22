import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loadMonthlyBudget } from '@/features/life'
import { cx } from '@/lib/cx'
import { SelectedTopicChip, SuggestedTopicChip, TopicPicker } from './TopicPicker'
import { askAi, createConversation, recordExchange } from '../api'
import { usePhotoStore, type SpendCard } from '../store'
import { BUDGET_LOAD_ERROR, PHOTO_NOTE, SUMMARY_ASK, chatMessageText, getTopicSuggestion, keywordReply, topicById, usesAiReply, type Topic, type TopicAction, type TopicSuggestion } from '../topics'
import { budgetSummaryText } from '../budgetSummary'
import { BudgetSummaryCard } from './BudgetSummaryCard'
import styles from './AiChat.module.css'
import { BillPhotoQuestion } from './BillPhotoQuestion'
import { UsageGuide } from './UsageGuide'
import { NearbySearch } from './NearbySearch'
import { NEARBY_PROMPT } from '../nearbySearch'
import { supportGuide } from '../usageGuide'
import guideStyles from './UsageGuide.module.css'
import { useAuthStore } from '@/features/auth'

type Props = {
  region: string
  name: string
}

type AiRequest = { id: string; text: string; topic: string }

type Msg = {
  role: 'user' | 'bot'
  text: string
  photo?: string
  action?: TopicAction | null
  suggestion?: TopicSuggestion
  budget?: SpendCard
  nearbyKeyword?: string
  quotaRequest?: AiRequest
}

export function AiChat({ region, name }: Props) {
  const accountId = useAuthStore((s) => s.user?.id)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const photoUrl = usePhotoStore((s) => s.photoUrl)
  const setPhoto = usePhotoStore((s) => s.setPhoto)
  const clearPhoto = usePhotoStore((s) => s.clearPhoto)
  const ctx = { region, name, hasPhoto: !!photoUrl }

  const [msgs, setMsgs] = useState<Msg[]>([])
  const quotaRequest = msgs.at(-1)?.quotaRequest
  // 다른 화면에서 ?topic=trash&fill=치킨뼈 로 들어오면 그 분야를 바로 펼침
  const [guideSource, setGuideSource] = useState<'topic' | 'quota' | null>(() => params.get('topic') === 'guide' ? 'topic' : null)
  const [topic, setTopic] = useState<Topic | null>(() => guideSource ? null : topicById(params.get('topic')))
  const [keyword, setKeyword] = useState(() => topic?.input ? params.get('fill') ?? '' : '')
  const summarySelected = topic?.id === 'summary'
  const nearbySelected = topic?.id === 'nearby'
  const [pending, setPending] = useState(false)
  const [plus, setPlus] = useState(false)
  const [copied, setCopied] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const topicTrigger = useRef<HTMLButtonElement>(null)
  const quotaGuideTrigger = useRef<HTMLButtonElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  const conversation = useRef<string | null>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // 주소의 ?topic= 은 한 번 읽고 지움 (새로고침해도 같은 분야가 계속 열리지 않게)
  useEffect(() => {
    if (params.has('topic')) setParams({}, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    if (!guideSource) endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, pending, guideSource])

  const pickTopic = (t: Topic, original?: string) => {
    if (t.id === 'guide') {
      setGuideSource('topic')
      setPlus(false)
      return
    }
    if (original === undefined && topic?.id === t.id) {
      setTopic(null)
      return
    }
    setTopic(t)
    if (t.id === 'nearby') setPlus(false)
    setKeyword(t.input ? original ?? '' : '')
    if (t.input) requestAnimationFrame(() => inputRef.current?.focus())
  }

  const closeGuide = () => {
    const trigger = guideSource === 'quota' ? quotaGuideTrigger : topicTrigger
    setGuideSource(null)
    requestAnimationFrame(() => (trigger.current ?? topicTrigger.current)?.focus({ preventScroll: true }))
  }

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    setPlus(false)
    if (f && f.type.startsWith('image/')) setPhoto(f)
  }

  const requestAi = async (request: AiRequest) => {
    const answer = await askAi(request.id, request.text, request.topic)
    if (!alive.current) return true
    if (!answer) return false
    setMsgs((m) => [...m, {
      role: 'bot',
      text: answer.text,
      quotaRequest: answer.kind === 'gemini-quota' ? request : undefined,
    }])
    setPending(false)
    return true
  }

  const showSupportGuide = (request: AiRequest) => {
    const { name, path, steps, to, link } = supportGuide
    const instructions = steps.map((step, i) => `${i + 1}. ${step}`).join('\n')
    setMsgs((m) => [...m,
      { role: 'user', text: name },
      { role: 'bot', text: `${path}\n\n${instructions}`, action: { kind: 'link', to, label: link }, quotaRequest: request },
    ])
  }

  const retryQuestion = async (request: AiRequest) => {
    if (pending) return
    setPending(true)
    setMsgs((m) => [...m, { role: 'user', text: request.text }])
    inputRef.current?.focus({ preventScroll: true })
    if (await requestAi(request)) return
    setMsgs((m) => [...m, { role: 'bot', text: 'AI 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.', quotaRequest: request }])
    setPending(false)
  }

  const send = () => {
    const text = chatMessageText(topic, keyword)
    if ((!text && (nearbySelected || !photoUrl)) || pending) return
    const t = topic
    const isSummary = summarySelected || ((!t || t.id === 'qna') && SUMMARY_ASK.test(text))
    const sentPhoto = isSummary || nearbySelected ? null : photoUrl
    const redirect = getTopicSuggestion(t, text)
    setMsgs((m) => [...m, { role: 'user', text, photo: redirect ? undefined : sentPhoto ?? undefined }])
    // 말풍선에 쓰는 사진 주소는 지우지 않고 첨부 칸만 비움
    if (!redirect) {
      if (sentPhoto) usePhotoStore.setState({ photoUrl: null })
      if (summarySelected) setTopic(null)
      if (nearbySelected) setMsgs((m) => [...m, { role: 'bot', text: NEARBY_PROMPT, nearbyKeyword: text }])
    } else {
      setMsgs((m) => [...m, { role: 'bot', ...redirect }])
    }
    setKeyword('')
    setPending(true)
    // 대화방: 이 화면에서 처음 물을 때 만들고 계속 이어 씀 (서버를 못 쓰면 null → 이 화면에서만 대화)
    void (async () => {
      if (!conversation.current && text) conversation.current = await createConversation('AI_PAGE', isSummary ? 'summary' : t?.id)
      const id = conversation.current
      if (redirect) {
        if (!sentPhoto) await recordExchange(id, text, redirect.text, { type: 'LINK', data: { to: '/ai', ...redirect.suggestion } })
        if (alive.current) setPending(false)
        return
      }
      if (nearbySelected) {
        void recordExchange(id, text, NEARBY_PROMPT, { type: 'LINK', data: { to: '/map', nearbyKeyword: text } })
        if (alive.current) setPending(false)
        return
      }
      if (isSummary) {
        if (!alive.current) return
        const summary = await loadMonthlyBudget().catch(() => null)
        if (!alive.current) return
        setMsgs((m) => [...m, summary
          ? { role: 'bot', text: '', budget: summary }
          : { role: 'bot', text: BUDGET_LOAD_ERROR }])
        if (summary) void recordExchange(id, text, budgetSummaryText(summary), { type: 'SPEND_SUMMARY', data: summary })
        setPending(false)
        return
      }
      if (id && text && !sentPhoto && usesAiReply(t) && await requestAi({ id, text, topic: t?.id ?? 'qna' })) return
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (!alive.current) return
      let out = !text ? '사진을 받았어요. 어떤 도움이 필요한지 아래에서 주제를 골라 물어봐 주세요.' : t?.reply?.(text, ctx) ?? keywordReply(text)
      if (sentPhoto && (t?.photo || !text)) out += PHOTO_NOTE
      setMsgs((m) => [...m, { role: 'bot', text: out, action: t?.action?.(text) ?? null }])
      // 사진은 개인정보 방침상 저장하지 않으므로 사진 없는 질문만 대화방에 저장
      if (text && !sentPhoto) void recordExchange(id, text, out)
      setPending(false)
    })()
  }

  const runAction = (a: TopicAction, text: string, i: number) => {
    if (a.kind === 'link') return navigate(a.to)
    // 문자 복사: 첫 문단(안내)과 마지막 문단(※ 메모)을 빼고 본문만
    const body = text.split('\n\n').slice(1, -1).join('\n\n')
    navigator.clipboard.writeText(body).then(
      () => setCopied(i),
      () => setCopied(-1),
    )
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={styles.chat}>
      {guideSource && <UsageGuide onBack={closeGuide} onNavigate={closeGuide} />}
      <div className={guideStyles.conversation} hidden={!!guideSource}>
        <div className={styles.scroll} role="log" aria-label="AI 대화">
          {!msgs.length && (
            <div className={styles.empty}>
              <b>무엇을 도와드릴까요?</b>
              <small>주제를 고르거나 바로 물어보세요.</small>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={cx(styles.msg, m.role === 'user' ? styles.user : styles.bot, (m.budget || m.nearbyKeyword) && styles.detailMessage)}>
              {m.photo && <img src={m.photo} alt="첨부한 사진" className={styles.sentPhoto} />}
              {m.nearbyKeyword ? <NearbySearch keyword={m.nearbyKeyword} /> : m.text && <p>{m.text}</p>}
              {m.budget && <BudgetSummaryCard card={m.budget} onGo={() => navigate('/my/budget')} />}
              {m.suggestion && <SuggestedTopicChip suggestion={m.suggestion} disabled={pending} onPick={pickTopic} />}
              {m.action && (
                <button type="button" className={styles.actionBtn} onClick={() => runAction(m.action!, m.text, i)}>
                  {copied === i ? '복사됐어요' : m.action.label}
                </button>
              )}
            </div>
          ))}
          {quotaRequest && (
            <div className={styles.quotaMenu} role="group" aria-label="AI 사용량 소진 시 선택할 수 있는 기능">
              <button ref={quotaGuideTrigger} type="button" onClick={() => { setGuideSource('quota'); setPlus(false) }}>사용 방법</button>
              <button type="button" onClick={() => showSupportGuide(quotaRequest)}>{supportGuide.name}</button>
              <button type="button" onClick={() => void retryQuestion(quotaRequest)}>질문 다시 보내기</button>
            </div>
          )}
          {pending && (
            <div className={cx(styles.msg, styles.bot, styles.typing)} aria-label="답변 쓰는 중">
              <i />
              <i />
              <i />
            </div>
          )}
          <div ref={endRef} />
        </div>

        <TopicPicker activeId={topic?.id} suggestPhoto={!!photoUrl} triggerRef={topicTrigger} onPick={pickTopic} />
        {topic?.id === 'bill' && <BillPhotoQuestion key={accountId} entryPoint="AI_PAGE"
          onExchange={(question, answer, registered) => setMsgs((m) => [...m, { role: 'user', text: question }, { role: 'bot', text: answer,
            action: registered ? { kind: 'link', to: '/my/budget/expense', label: '고정 지출에서 확인' } : null }])} />}

        {photoUrl && (
          <div className={styles.attached}>
            <img src={photoUrl} alt="첨부한 사진" />
            <button type="button" onClick={clearPhoto} aria-label="사진 빼기">
              ✕
            </button>
          </div>
        )}

        <div className={styles.barWrap}>
          {topic && <SelectedTopicChip topic={topic} onClear={() => setTopic(null)} />}
          {plus && (
            <>
              <div className={styles.backdrop} onClick={() => setPlus(false)} />
              <div className={styles.plusMenu} role="menu">
                <button type="button" role="menuitem" onClick={() => cameraRef.current?.click()}>
                  <span aria-hidden="true">📷</span> 카메라로 찍기
                </button>
                <button type="button" role="menuitem" onClick={() => fileRef.current?.click()}>
                  <span aria-hidden="true">🖼️</span> 사진·파일 고르기
                </button>
              </div>
            </>
          )}
          <form
            className={styles.bar}
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <button type="button" className={cx(styles.plus, plus && styles.plusOn)} onClick={() => setPlus((v) => !v)} disabled={nearbySelected} aria-label="사진 첨부" aria-haspopup="menu" aria-expanded={plus}>
              <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <textarea ref={inputRef} rows={1} value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={onKey} placeholder={summarySelected ? '보내기를 눌러 수입 대비 지출을 확인하세요' : topic?.input?.placeholder ?? '궁금한 키워드나 질문을 입력하세요'} aria-label={topic?.input?.label ?? '질문 입력'} disabled={summarySelected} />
            <button type="submit" className={styles.send} disabled={pending || (!keyword.trim() && !summarySelected && (nearbySelected || !photoUrl))} aria-label="보내기">
              <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
                <path d="M12 19V6M6 11l6-6 6 6" />
              </svg>
            </button>
          </form>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        </div>
      </div>
    </div>
  )
}
