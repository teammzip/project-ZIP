import house from '@/assets/images/house-mobile.png'
import robot from '@/assets/images/robot-cut.png'
import { CTA } from '../content'
import { Bubble } from './Bubble'
import { Reveal } from './Reveal'
import { SectionHead } from './SectionHead'
import styles from './CtaSection.module.css'

type Props = {
  onLogin: () => void
  onSignup: () => void
}

/** 마지막 화면: 가운데 제목 + 파란 둥근 로그인 버튼 · 회원가입 글자 버튼, 아래에 3D 집 앞 로봇과 말풍선 */
export function CtaSection({ onLogin, onSignup }: Props) {
  return (
    <section className={styles.section}>
      <SectionHead kicker={CTA.kicker} title={CTA.title} body={CTA.body} align="center" />
      <Reveal delay={0.2} className={styles.buttons}>
        <button type="button" className={styles.primary} onClick={onLogin}>
          로그인하고 시작 <span aria-hidden="true">↗</span>
        </button>
        <button type="button" className={styles.secondary} onClick={onSignup}>
          처음이세요? <b>회원가입</b>
        </button>
      </Reveal>
      <div className={styles.visual} aria-hidden="true">
        <img src={house} alt="" className={styles.house} />
        <img src={robot} alt="" className={styles.robot} />
        <Bubble text={CTA.bubble} className={styles.bubble} delay={0.3} />
      </div>
    </section>
  )
}
