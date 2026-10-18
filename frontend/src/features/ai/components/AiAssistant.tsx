import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { usePhotoStore } from '../store'
import { PHOTO_NOTE, TOPICS, topicById, type Topic, type TopicAction } from '../topics'
import { PhotoPicker } from './PhotoPicker'
import styles from './Ai.module.css'

type Props = {
  region: string
  name: string
  /** 사진 화면: 사진이 없으면 분야 대신 사진 고르기를 먼저 보여줌 */
  photoFirst?: boolean
}

/** AI 도우미(데모): 분야 선택 → 질문 초안 → 정해진 답변. 사진 첨부 가능.
 * ?topic=trash&fill=치킨뼈 로 열면 그 분야를 바로 펼침 */
export function AiAssistant({ region, name, photoFirst }: Props) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { photoUrl, clearPhoto } = usePhotoStore()
  const ctx = { region, name, hasPhoto: !!photoUrl }

  const [topic, setTopic] = useState<Topic | null>(() => topicById(params.get('topic')))
  const [values, setValues] = useState<Record<string, string>>(() => {
    const t = topicById(params.get('topic'))
    const fill = params.get('fill')
    return t && fill ? { [t.fields[0].k]: fill } : {}
  })
  const [customDraft, setCustomDraft] = useState<string | null>(null) // 사용자가 직접 고친 초안 (null 이면 자동 초안)
  const [answer, setAnswer] = useState<{ text: string; action: TopicAction | null } | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState('')
  const seq = useRef(0)
  const firstInput = useRef<HTMLInputElement>(null)

  const draft = customDraft ?? (topic ? topic.draft(values, ctx) : '')

  // 주소의 ?topic= 은 한 번 읽고 지움 (새로고침해도 같은 분야가 계속 열리지 않게)
  useEffect(() => {
    if (params.has('topic')) setParams({}, { replace: true })
  }, [params, setParams])

  useEffect(() => {
    if (topic) firstInput.current?.focus()
  }, [topic])

  const openTopic = (t: Topic | null) => {
    seq.current++
    setTopic(t)
    setValues({})
    setCustomDraft(null)
    setAnswer(null)
    setPending(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!topic || !text) return
    const id = ++seq.current
    const t = topic
    const v = values
    setPending(true)
    setAnswer(null)
    setCopied('')
    setTimeout(() => {
      if (id !== seq.current) return // 그 사이 다른 분야를 골랐으면 버림
      let out = t.reply(v, text, ctx)
      if (ctx.hasPhoto && t.photo) out += PHOTO_NOTE
      setAnswer({ text: out, action: t.action?.(v) ?? null })
      setPending(false)
    }, 500)
  }

  const runAction = (a: TopicAction, text: string) => {
    if (a.kind === 'map') {
      navigate(`/map?cat=${encodeURIComponent(a.cat)}`)
      return
    }
    if (a.kind === 'link') {
      navigate(a.to)
      return
    }
    // 문자 복사: 첫 문단(안내)과 마지막 문단(※ 메모)을 빼고 본문만
    const body = text.split('\n\n').slice(1, -1).join('\n\n')
    navigator.clipboard.writeText(body).then(
      () => setCopied('복사됐어요'),
      () => setCopied('복사 실패'),
    )
  }

  const showPicker = photoFirst && !photoUrl

  return (
    <div className={common.layout}>
      <Card title={showPicker ? '사진으로 물어보기' : '어떤 도움이 필요하세요?'} actions={<span className={cx(common.tag, common.tagPurple)}>데모 응답</span>}>
        {showPicker ? (
          <div className={styles.pickerBox}>
            <span className={styles.pickerIco} aria-hidden="true">
              📷
            </span>
            <p>
              버릴 물건, 냉장고 속 재료, 곰팡이 핀 곳을 찍어 올리면
              <br />
              도움받을 분야를 추천해 드려요.
            </p>
            <PhotoPicker onPicked={() => openTopic(null)} />
            <small>현재는 데모로, 사진 내용을 직접 분석하지 않습니다.</small>
          </div>
        ) : (
          <>
            <p className={styles.help}>분야를 고르면 좋은 답변을 받을 수 있는 질문 초안을 만들어 드려요.</p>
            {photoUrl ? (
              <div className={styles.photoBox}>
                <img src={photoUrl} alt="첨부한 사진" />
                <div className={styles.photoInfo}>
                  <b>사진이 첨부됐어요</b>
                  <small>도움받을 분야를 골라주세요.</small>
                </div>
                <Button variant="line" onClick={clearPhoto}>
                  사진 빼기
                </Button>
              </div>
            ) : (
              <PhotoPicker variant="line" label="사진 첨부" onPicked={() => openTopic(null)} className={styles.attach} />
            )}
            <div className={styles.topicGrid}>
              {TOPICS.map((t) => {
                const suggest = !!photoUrl && t.photo
                return (
                  <button key={t.id} type="button" className={cx(styles.topic, topic?.id === t.id && styles.on, suggest && styles.suggest)} aria-pressed={topic?.id === t.id} onClick={() => openTopic(t)}>
                    <span className={styles.topicIco}>{t.ico}</span>
                    <b>
                      {t.name}
                      {suggest && ' · 추천'}
                    </b>
                    <small>{t.desc}</small>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </Card>

      <Card
        title={topic ? `${topic.ico} ${topic.name} 질문 초안` : '질문 초안'}
        actions={
          topic && (
            <Button variant="line" onClick={() => openTopic(null)}>
              다른 분야
            </Button>
          )
        }
      >
        {!topic ? (
          <p className={common.empty}>{showPicker ? '사진을 고르면 분야를 추천해 드려요.' : '왼쪽에서 분야를 골라주세요.'}</p>
        ) : (
          <form className={common.form} onSubmit={submit}>
            {topic.fields.map((f, i) => (
              <label key={f.k}>
                {f.label}
                <input
                  ref={i === 0 ? firstInput : undefined}
                  value={values[f.k] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.k]: e.target.value })}
                  maxLength={80}
                  placeholder={f.ph}
                />
              </label>
            ))}
            <label>
              질문 초안 (직접 고쳐도 돼요)
              <textarea rows={8} value={draft} onChange={(e) => setCustomDraft(e.target.value)} />
            </label>
            <Button type="submit" block loading={pending}>
              AI에게 보내기
            </Button>
          </form>
        )}
        {answer && (
          <>
            <div className={styles.answer} aria-live="polite">
              {answer.text}
            </div>
            {answer.action && (
              <div className={styles.answerActions}>
                <Button variant="line" onClick={() => runAction(answer.action!, answer.text)}>
                  {copied || answer.action.label}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
