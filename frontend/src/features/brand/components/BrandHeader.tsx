import { useMotionValueEvent, useScroll } from 'motion/react'
import { useState } from 'react'
import logo from '@/assets/images/logo-zip.png'
import { cx } from '@/lib/cx'
import styles from './BrandHeader.module.css'

type Props = {
  onLogin: () => void
  onSignup: () => void
  /** 첫 화면에 이미 큰 로그인 버튼이 있을 때(모바일): 첫 화면을 반쯤 지나야 오른쪽 버튼이 나타남 */
  actionsOnScroll?: boolean
}

/** 섹션으로 바로 가는 메뉴 (PC 만) */
const NAV = [
  { href: '#features', label: '기능' },
  { href: '#stories', label: '이야기' },
  { href: '#steps', label: '시작하기' },
]

/** 위쪽 고정 바: 로고 · 메뉴 · 로그인 · 회원가입(검은 둥근 버튼). 조금 내리면 반투명 흰 배경 */
export function BrandHeader({ onLogin, onSignup, actionsOnScroll }: Props) {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [past, setPast] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 40)
    setPast(y > window.innerHeight * 0.6)
  })
  const hideActions = actionsOnScroll && !past

  return (
    <header className={cx(styles.header, scrolled && styles.scrolled)}>
      <a href="#top" className={styles.logo} aria-label="ZIP 맨 위로">
        <img src={logo} alt="ZIP" />
      </a>
      <nav className={styles.nav} aria-label="시작 화면 메뉴">
        {NAV.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
      </nav>
      <div className={cx(styles.actions, hideActions && styles.hidden)} inert={hideActions || undefined}>
        <button type="button" className={styles.login} onClick={onLogin}>
          로그인
        </button>
        <button type="button" className={styles.signup} onClick={onSignup}>
          회원가입
        </button>
      </div>
    </header>
  )
}
