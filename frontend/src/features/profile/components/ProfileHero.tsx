import type { ReactNode } from 'react'
import { Button } from '@/components/ui'
import { DEFAULT_BIO } from '../constants'
import { useProfileStore } from '../store'
import { Avatar } from './Avatar'
import styles from './Profile.module.css'

type Props = {
  name: string
  region: string
  /** 이름 아래 작은 배지 (예: 로그인 방식) */
  badge?: ReactNode
  onEdit: () => void
}

/** 내 정보 맨 위 프로필 카드: 사진(누르면 편집), 닉네임, 한 줄 소개, 동네 */
export function ProfileHero({ name, region, badge, onEdit }: Props) {
  const bio = useProfileStore((s) => s.bio)
  return (
    <section className={styles.hero}>
      <button type="button" className={styles.photo} onClick={onEdit} aria-label="프로필 사진 바꾸기">
        <Avatar name={name} size={84} className={styles.heroAva} />
        <span className={styles.cam} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
      </button>
      <div className={styles.id}>
        <b>{name}</b>
        <p>{bio || DEFAULT_BIO}</p>
        <small>📍 {region || '동네를 정해 주세요'}</small>
        {badge}
      </div>
      <Button variant="line" className={styles.edit} onClick={onEdit}>
        프로필 편집
      </Button>
    </section>
  )
}
