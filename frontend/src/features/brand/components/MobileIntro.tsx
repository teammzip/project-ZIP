import { useEffect, useRef } from 'react'
import logo from '@/assets/images/logo-zip.png'
import robot from '@/assets/images/robot-cut.png'
import { HERO, HERO_TILES } from '../content'
import styles from './MobileIntro.module.css'

type Props = {
  onEnter: () => void
  onSignup: () => void
  paused: boolean
  autoDoor?: boolean
}

/** PC와 같은 환영 문구와 생활 카드, 모바일의 ZIP 도우미 로봇. */
export function MobileIntro({ onEnter, onSignup, paused, autoDoor = false }: Props) {
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoDoor && !autoOpened.current) {
      autoOpened.current = true
      onEnter()
    }
  }, [autoDoor, onEnter])

  const tiles = HERO_TILES.filter((tile) => tile.kind === 'widget' || tile.kind === 'illust').slice(0, 4)

  return (
    <div className={styles.scene}>
      <header className={styles.header}>
        <a href="#top" aria-label="ZIP 맨 위로"><img src={logo} alt="ZIP" /></a>
      </header>
      <main id="top" className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.kicker}>{HERO.kicker}</p>
          <h1 className={styles.title}>{HERO.lines.map((line) => <span key={line}>{line}</span>)}</h1>
          <p className={styles.description}>흩어져 있던 자취 생활을 한곳에.<br />혼자여도 든든한 하루를 시작해요.</p>
        </div>
        <div className={styles.visual}>
          <div className={styles.tiles} aria-hidden="true">
            {tiles.map((tile, index) => (
              <div key={index} className={`${styles.tile} ${styles[`tile${index}`]}`}>
                {tile.kind === 'widget' ? (
                  <div className={styles.widget}>
                    <span className={styles.icon} style={{ background: tile.tone }}>{tile.icon}</span>
                    <span><small>{tile.label}</small><b>{tile.value}</b></span>
                  </div>
                ) : tile.kind === 'illust' ? (
                  <div className={styles.illustration} style={{ background: tile.bg }}>{tile.emoji}</div>
                ) : null}
              </div>
            ))}
          </div>
          <img src={robot} alt="반갑게 맞이하는 ZIP 도우미 로봇" className={styles.robot} />
          <span className={styles.greeting}>함께 시작해 볼까요?</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onEnter} disabled={paused}>로그인하고 시작</button>
          <button type="button" className={styles.signup} onClick={onSignup}>처음이세요? <b>회원가입</b></button>
        </div>
      </main>
    </div>
  )
}
