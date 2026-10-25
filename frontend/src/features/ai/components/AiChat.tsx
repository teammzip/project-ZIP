import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cx } from '@/lib/cx'
import { TopicCards } from './TopicCards'
import { usePhotoStore } from '../store'
import { PHOTO_NOTE, keywordReply, topicById, type Topic, type TopicAction } from '../topics'
import styles from './AiChat.module.css'

type Props = {
  region: string
  name: string
}

type Msg = { role: 'user' | 'bot'; text: string; photo?: string; action?: TopicAction | null }

/** AI 화면 (채팅 모양, PC·모바일 같음): 위는 대화, 아래에 분야 카드 → 입력줄(＋ 로 카메라·사진 고르기).
 * 분야 카드를 누르면 그 분야의 질문 초안이 입력줄에 채워지고, 보내면 정해진 답변(데모)이 나옵니다. */
export function AiChat({ region, name }: Props) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const photoUrl = usePhotoStore((s) => s.photoUrl)
  const setPhoto = usePhotoStore((s) => s.setPhoto)
  const clearPhoto = usePhotoStore((s) => s.clearPhoto)
  const ctx = { region, name, hasPhoto: !!photoUrl }

  const [msgs, setMsgs] = useState<Msg[]>([])
  // 다른 화면에서 ?topic=trash&fill=치킨뼈 로 들어오면 그 분야를 바로 펼침
  const [topic, setTopic] = useState<Topic | null>(() => topicById(params.get('topic')))
  const [values, setValues] = useState<Record<string, string>>(() => {
    const t = topicById(params.get('topic'))
    const fill = params.get('fill')
    return t && fill ? { [t.fields[0].k]: fill } : {}
  })
  const [customDraft, setCustomDraft] = useState<string | null>(null) // 직접 고친 초안 (null 이면 자동 초안)
  const [free, setFree] = useState('') // 분야 없이 바로 쓰는 질문
  const [pending, setPending] = useState(false)
  const [plus, setPlus] = useState(false)
  const [copied, setCopied] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)

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
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs, pending])

  const value = topic ? (customDraft ?? topic.draft(values, ctx)) : free
  const setValue = (v: string) => (topic ? setCustomDraft(v) : setFree(v))

  const pickTopic = (t: Topic) => {
    if (topic?.id === t.id) return closeTopic()
    setTopic(t)
    setValues({})
    setCustomDraft(null)
  }
  const closeTopic = () => {
    setTopic(null)
    setValues({})
    setCustomDraft(null)
  }

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    setPlus(false)
    if (f && f.type.startsWith('image/')) setPhoto(f)
  }

  // PC: 마우스로도 옆으로 넘길 수 있게 ‹ › 단추와 휠(세로 휠 → 가로) 지원

  const send = () => {
    const text = value.trim()
    if ((!text && !photoUrl) || pending) return
    const t = topic
    const v = values
    const sentPhoto = photoUrl
    setMsgs((m) => [...m, { role: 'user', text, photo: sentPhoto ?? undefined }])
    // 말풍선에 쓰는 사진 주소는 지우지 않고 첨부 칸만 비움
    usePhotoStore.setState({ photoUrl: null })
    closeTopic()
    setFree('')
    setPending(true)
    setTimeout(() => {
      if (!alive.current) return
      let out = !text ? '사진을 받았어요. 어떤 도움이 필요한지 아래 카드에서 분야를 골라 물어봐 주세요.' : t ? t.reply(v, text, ctx) : keywordReply(text)
      if (sentPhoto && (t?.photo || !text)) out += PHOTO_NOTE
      setMsgs((m) => [...m, { role: 'bot', text: out, action: t?.action?.(v, text) ?? null }])
      setPending(false)
    }, 500)
  }

  const runAction = (a: TopicAction, text: string, i: number) => {
    if (a.kind === 'map') return navigate(`/map?cat=${encodeURIComponent(a.cat)}`)
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
      <div className={styles.scroll}>
        {!msgs.length && (
          <div className={styles.empty}>
            <b>무엇을 도와드릴까요?</b>
            <small>아래 카드를 고르거나 바로 물어보세요.</small>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cx(styles.msg, m.role === 'user' ? styles.user : styles.bot)}>
            {m.photo && <img src={m.photo} alt="첨부한 사진" className={styles.sentPhoto} />}
            {m.text && <p>{m.text}</p>}
            {m.action && (
              <button type="button" className={styles.actionBtn} onClick={() => runAction(m.action!, m.text, i)}>
                {copied === i ? '복사됐어요' : m.action.label}
              </button>
            )}
          </div>
        ))}
        {pending && (
          <div className={cx(styles.msg, styles.bot, styles.typing)} aria-label="답변 쓰는 중">
            <i />
            <i />
            <i />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* 분야 카드: 둥근 직사각형, 2줄로 놓고 옆으로 밀거나 끌어서 고름 (홈 대화 모달과 같은 카드) */}
      <TopicCards activeId={topic?.id} suggestPhoto={!!photoUrl} onPick={pickTopic} />

      {topic && (
        <div className={styles.fields}>
          <div className={styles.fieldsHead}>
            <b>
              {topic.ico} {topic.name}
            </b>
            <button type="button" onClick={closeTopic} aria-label="분야 닫기">
              ✕
            </button>
          </div>
          {topic.fields.map((f, i) => (
            <label key={f.k}>
              {f.label}
              <input
                autoFocus={i === 0}
                value={values[f.k] ?? ''}
                onChange={(e) => {
                  setValues({ ...values, [f.k]: e.target.value })
                  setCustomDraft(null) // 칸을 고치면 초안을 다시 자동으로 만듦
                }}
                maxLength={80}
                placeholder={f.ph}
              />
            </label>
          ))}
        </div>
      )}

      {photoUrl && (
        <div className={styles.attached}>
          <img src={photoUrl} alt="첨부한 사진" />
          <button type="button" onClick={clearPhoto} aria-label="사진 빼기">
            ✕
          </button>
        </div>
      )}

      <div className={styles.barWrap}>
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
          <button type="button" className={cx(styles.plus, plus && styles.plusOn)} onClick={() => setPlus((v) => !v)} aria-label="사진 첨부" aria-haspopup="menu" aria-expanded={plus}>
            <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <textarea rows={1} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey} placeholder="궁금한 걸 물어보세요" aria-label="질문 입력" />
          <button type="submit" className={styles.send} disabled={pending || (!value.trim() && !photoUrl)} aria-label="보내기">
            <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
              <path d="M12 19V6M6 11l6-6 6 6" />
            </svg>
          </button>
        </form>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
      </div>
    </div>
  )
}
