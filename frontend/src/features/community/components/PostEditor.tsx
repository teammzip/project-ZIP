import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/lib/cx'
import { checkAttachments, MAX_ATTACHMENTS, readAttachments, STORAGE_FULL } from '../attachments'
import { CAT_ICON } from '../data/display'
import { CATEGORIES } from '../data/seed'
import type { Attachment, Post, PostDraft } from '../types'
import styles from './Community.module.css'


const TITLE_MAX = 60
const BODY_MAX = 500
const GUIDE = `동네 이웃과 나누고 싶은 이야기를 적어 주세요.

· 자취 꿀팁, 궁금한 점, 우리 동네 소식 모두 좋아요.
· 다른 사람의 개인정보(연락처, 집 주소 등)는 올리지 말아 주세요.
· 욕설 · 비방 · 광고 글은 운영 정책에 따라 숨겨질 수 있어요.`

type Props = {
  open: boolean
  onClose: () => void
  /** 고칠 글 (없으면 새 글) */
  initial?: Post
  locked?: boolean
  /** 글이 올라갈 동네 (표시만) */
  region?: string
  /** 저장 공간이 부족해 실패하면 false */
  onSave: (draft: PostDraft) => boolean
}

/** 글쓰기 화면 (에브리타임 글쓰기처럼): 위 ✕ · 글 쓰기 · 완료 → 주제 칩 → 큰 제목 → 넓은 본문 → 아래 📷 사진 · 글자 수 · 동네.
 * 모바일은 화면 전체, PC 는 가운데 창. 쓰던 내용이 있으면 닫을 때 한 번 물어봄 */
export function PostComposer({ open, onClose, ...rest }: Props) {
  if (!open) return null
  return createPortal(<ComposerBody onClose={onClose} {...rest} />, document.body)
}

function ComposerBody({ onClose, initial, locked, region, onSave }: Omit<Props, 'open'>) {
  const [cat, setCat] = useState<string>(initial?.cat ?? CATEGORIES[0])
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [files, setFiles] = useState<Attachment[]>(initial?.attachments ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const dirty = title !== (initial?.title ?? '') || body !== (initial?.body ?? '') || files.length !== (initial?.attachments?.length ?? 0)
  const ready = !!title.trim() && !!body.trim() && !locked && !busy

  const close = () => {
    if (dirty && !window.confirm('쓰던 내용이 사라져요. 닫을까요?')) return
    onClose()
  }

  // 열려 있는 동안 뒤 화면 스크롤 막고, Esc 로 닫기
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const addFiles = async (list: FileList | null) => {
    const picked = Array.from(list ?? [])
    if (fileInput.current) fileInput.current.value = ''
    if (!picked.length) return
    const problem = checkAttachments(files, picked)
    if (problem) return setError(problem)
    try {
      setFiles([...files, ...(await readAttachments(picked))])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '첨부 파일을 처리하지 못했어요.')
    }
  }

  const submit = () => {
    if (!ready) return setError(locked ? '이용 정지 중에는 글을 쓸 수 없어요.' : '제목과 내용을 입력해 주세요.')
    setBusy(true)
    const ok = onSave({ cat, title: title.trim(), body: body.trim(), attachments: files })
    setBusy(false)
    if (!ok) return setError(STORAGE_FULL)
    onClose()
  }

  return (
    <div className={styles.composerRoot}>
      <div className={styles.composerBackdrop} onClick={close} />
      <section className={styles.composer} role="dialog" aria-modal="true" aria-labelledby="composer-title">
        <header className={styles.composerBar}>
          <button type="button" className={styles.composerX} onClick={close} aria-label="닫기">
            ✕
          </button>
          <h2 id="composer-title">{initial ? '글 수정' : '글 쓰기'}</h2>
          <button type="button" className={cx(styles.composerDone, ready && styles.ready)} onClick={submit} aria-disabled={!ready}>
            {busy ? '저장 중…' : '완료'}
          </button>
        </header>

        <div className={styles.composerScroll}>
          {/* 주제 */}
          <div className={styles.composerCats} role="radiogroup" aria-label="주제">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={cat === c} className={cx(styles.topic, cat === c && styles.on)} onClick={() => setCat(c)}>
                {CAT_ICON[c]} {c}
              </button>
            ))}
          </div>

          <input
            className={styles.composerTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder="제목"
            aria-label="제목"
            disabled={locked}
            autoFocus
          />
          <textarea className={styles.composerBody} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} placeholder={GUIDE} aria-label="내용" disabled={locked} />

          {/* 첨부 미리보기 (✕ 로 빼기) */}
          {files.length > 0 && (
            <div className={styles.composerFiles}>
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className={styles.composerFile}>
                  {f.type.startsWith('image/') && f.data.startsWith('data:') ? <img src={f.data} alt={f.name} /> : <span className={styles.fileName}>📎 {f.name}</span>}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`${f.name} 빼기`}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className={styles.composerError} role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className={styles.composerTools}>
          <button type="button" className={styles.toolBtn} onClick={() => fileInput.current?.click()} disabled={locked || files.length >= MAX_ATTACHMENTS} aria-label="사진 · 파일 첨부">
            📷 <span>
              {files.length}/{MAX_ATTACHMENTS}
            </span>
          </button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <span className={styles.toolGrow} />
          {region && <span className={styles.toolRegion}>📍 {region}</span>}
          <span className={cx(styles.toolCount, body.length > BODY_MAX - 50 && styles.warn)}>
            {body.length}/{BODY_MAX}
          </span>
        </footer>
      </section>
    </div>
  )
}

/** 첨부 보기: 사진은 바로 보이고, 다른 파일은 내려받기 링크 */
export function Attachments({ files }: { files: Attachment[] }) {
  return (
    <div className={styles.attachments}>
      {files.map((f, i) => {
        const valid = f.data.startsWith('data:')
        return valid && f.type.startsWith('image/') ? (
          <a key={`${f.name}-${i}`} href={f.data} download={f.name} className={styles.photo}>
            <img src={f.data} alt={f.name} />
          </a>
        ) : (
          <a key={`${f.name}-${i}`} href={valid ? f.data : undefined} download={f.name} className={styles.fileLink}>
            📎 {f.name}
          </a>
        )
      })}
    </div>
  )
}
