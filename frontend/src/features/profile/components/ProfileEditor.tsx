import { useRef, useState, type FormEvent } from 'react'
import { Button, Modal } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { AVATAR_CHARS, AVATAR_COLORS } from '../constants'
import { resizeToSquare } from '../resizeImage'
import { canStore, useProfileStore } from '../store'
import type { ProfileLook } from '../types'
import { Avatar } from './Avatar'
import styles from './Profile.module.css'

type Props = {
  open: boolean
  onClose: () => void
  /** 닉네임은 로그인 정보(auth)에 있어서 쓰는 쪽이 넘겨 주고 저장도 맡음 */
  name: string
  onSaveName: (name: string) => void
  onSaved?: () => void
}

/** 프로필 편집 창: 사진 올리기 / 캐릭터 / 배경 색 / 닉네임 / 한 줄 소개 */
export function ProfileEditor({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="프로필 편집" className={styles.sheet}>
      {/* 열 때마다 저장된 값으로 새로 시작하도록 open 일 때만 그림 */}
      {open && <EditorBody onClose={onClose} {...rest} />}
    </Modal>
  )
}

function EditorBody({ onClose, name, onSaveName, onSaved }: Omit<Props, 'open'>) {
  const saved = useProfileStore()
  const [draft, setDraft] = useState<ProfileLook>({ avatarImg: saved.avatarImg, avatarEmoji: saved.avatarEmoji, avatarColor: saved.avatarColor, bio: saved.bio })
  const [nick, setNick] = useState(name)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('사진 파일만 올릴 수 있어요.')
    if (file.size > 10 * 1024 * 1024) return setError('10MB 이하 사진을 골라 주세요.')
    try {
      const avatarImg = await resizeToSquare(file)
      setDraft((d) => ({ ...d, avatarImg }))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextName = nick.trim()
    if (nextName.length < 2) return setError('닉네임은 2~12자로 입력해 주세요.')
    const look = { ...draft, bio: draft.bio.trim() }
    if (!canStore(look)) return setError('저장 공간이 부족해서 사진을 저장하지 못했어요. 더 작은 사진을 골라 주세요.')
    saved.save(look)
    if (nextName !== name) onSaveName(nextName)
    onSaved?.()
    onClose()
  }

  return (
    <form className={cx(common.form, styles.editor)} onSubmit={submit}>
      <h3 className={styles.sheetTitle}>프로필 편집</h3>
      <div className={styles.pick}>
        <Avatar name={nick || name} size={96} look={draft} />
        <div className={styles.pickBtns}>
          <Button variant="line" onClick={() => fileRef.current?.click()}>
            📷 사진 올리기
          </Button>
          <Button variant="line" onClick={() => setDraft((d) => ({ ...d, avatarImg: '', avatarEmoji: '', avatarColor: '' }))}>
            기본으로
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (pickFile(e.target.files?.[0]), (e.target.value = ''))} />
      </div>

      <p className={styles.label}>캐릭터로 고르기</p>
      <div className={styles.chars}>
        {AVATAR_CHARS.map((c) => (
          <button
            key={c}
            type="button"
            className={cx(styles.char, !draft.avatarImg && draft.avatarEmoji === c && styles.on)}
            aria-label={`캐릭터 ${c}`}
            aria-pressed={!draft.avatarImg && draft.avatarEmoji === c}
            onClick={() => setDraft((d) => ({ ...d, avatarImg: '', avatarEmoji: d.avatarEmoji === c ? '' : c }))}
          >
            {c}
          </button>
        ))}
      </div>

      <p className={styles.label}>배경 색</p>
      <div className={styles.colors}>
        {AVATAR_COLORS.map((c) => (
          <button
            key={c || 'base'}
            type="button"
            className={cx(styles.color, !c && styles.base, draft.avatarColor === c && styles.on)}
            style={c ? { background: c } : undefined}
            aria-label={c ? `배경 색 ${c}` : '기본 배경 색'}
            aria-pressed={draft.avatarColor === c}
            disabled={!!draft.avatarImg}
            onClick={() => setDraft((d) => ({ ...d, avatarColor: c }))}
          />
        ))}
      </div>

      <label>
        이름(닉네임)
        <input value={nick} onChange={(e) => setNick(e.target.value)} minLength={2} maxLength={12} required />
      </label>
      <label>
        한 줄 소개
        <input value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} maxLength={30} placeholder="예) 자취 2년 차, 요리 연습 중" />
      </label>
      {error && (
        <p className={common.formError} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" block>
        저장
      </Button>
    </form>
  )
}
