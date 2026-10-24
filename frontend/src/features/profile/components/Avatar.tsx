import type { CSSProperties } from 'react'
import { cx } from '@/lib/cx'
import { useProfileStore } from '../store'
import type { ProfileLook } from '../types'
import styles from './Avatar.module.css'

type Props = {
  name: string
  /** 지름(px) */
  size?: number
  className?: string
  /** 저장 전 미리보기처럼 저장된 값 대신 보여 줄 모양 */
  look?: Pick<ProfileLook, 'avatarImg' | 'avatarEmoji' | 'avatarColor'>
}

/** 프로필 동그라미: 사진 → 캐릭터 → 이름 첫 글자 순서로 보여 줌. 앱 어디서나 같은 모양 */
export function Avatar({ name, size = 40, className, look }: Props) {
  const saved = useProfileStore()
  const { avatarImg, avatarEmoji, avatarColor } = look ?? saved
  const style: CSSProperties = { width: size, height: size, fontSize: avatarEmoji && !avatarImg ? size * 0.55 : size * 0.4 }
  if (avatarImg) style.background = `#fff url("${avatarImg}") center / cover no-repeat`
  else if (avatarColor) style.background = avatarColor

  return (
    <span className={cx(styles.avatar, className)} style={style} aria-hidden="true">
      {avatarImg ? '' : avatarEmoji || name.charAt(0)}
    </span>
  )
}
