import { useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'
import logo from '@/assets/images/logo-zip.png'
import { Button } from '@/components/ui'
import { cx } from '@/lib/cx'
import styles from './BrandHeader.module.css'

type Props = {
  onLogin: () => void
  onSignup: () => void
}

/** 위쪽 고정 바. 조금 내리면 흰 배경이 깔림 */
export function BrandHeader({ onLogin, onSignup }: Props) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 40))

  return (
    <header className={cx(styles.header, scrolled && styles.scrolled)}>
      <a href="#top" className={styles.logo} aria-label="ZIP 맨 위로">
        <img src={logo} alt="ZIP" />
      </a>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onLogin}>
          로그인
        </Button>
        <Button onClick={onSignup}>회원가입</Button>
      </div>
    </header>
  )
}
