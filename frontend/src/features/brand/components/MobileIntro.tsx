import { useEffect, useRef } from 'react'
import house from '@/assets/images/house-mobile.png'
import robot from '@/assets/images/robot-cut.png'
import { HERO, HERO_WIDGETS } from '../content'
import { Bubble } from './Bubble'
import { Lines } from './SectionHead'
import styles from './MobileIntro.module.css'

type Props = {
  /** 로그인 창 열기 */
  onEnter: () => void
  onSignup: () => void
  /** 로그인 창이 열려 있는 동안 버튼을 잠금 */
  paused: boolean
  /** /start#login 으로 왔을 때 로그인 창을 바로 열기 */
  autoDoor?: boolean
}

/** 모바일 첫 화면: 위에 3D 집 앞 ZIP 로봇 · 말풍선 · 요약 카드, 아래에 제목 · 설명 · 로그인 버튼.
 * 위쪽 바는 StartPage 의 BrandHeader (스크롤하면 로그인 · 회원가입 버튼이 나타남). 아래로 내리면 질문 · 기능 섹션이 이어짐 */
export function MobileIntro({ onEnter, onSignup, paused, autoDoor = false }: Props) {
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoDoor && !autoOpened.current) {
      autoOpened.current = true
      onEnter()
    }
  }, [autoDoor, onEnter])

  return (
    <section id="top" className={styles.scene}>
      <div className={styles.hero}>
        <div className={styles.visual} aria-hidden="true">
          <img src={house} alt="" className={styles.house} />
          <img src={robot} alt="" className={styles.robot} />
          <Bubble text={HERO.greeting} className={styles.greeting} delay={0.4} />
          {HERO_WIDGETS.slice(0, 2).map((w, i) => (
            <div key={w.label} className={`${styles.widget} ${styles[`w${i}`]}`}>
              <span className={styles.icon} style={{ background: w.tone }}>
                {w.icon}
              </span>
              <span>
                <small>{w.label}</small>
                <b>{w.value}</b>
              </span>
            </div>
          ))}
        </div>

        <div className={styles.copy}>
          <p className={styles.kicker}>{HERO.kicker}</p>
          <h1 className={styles.title}>
            {HERO.lines.map((line, i) => (
              <span key={line} className={i === HERO.lines.length - 1 ? styles.accent : undefined}>
                {line}
              </span>
            ))}
          </h1>
          <p className={styles.description}>
            <Lines text={HERO.description} />
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onEnter} disabled={paused}>
            로그인하고 시작 <span aria-hidden="true">↗</span>
          </button>
          <button type="button" className={styles.signup} onClick={onSignup}>
            처음이세요? <b>회원가입</b>
          </button>
        </div>
        <a href="#question" className={styles.more}>
          ZIP 더 알아보기 <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  )
}
