import house from '@/assets/images/last-house.png'
import { Button, Reveal } from '@/components/ui'
import { Lines } from './SectionHead'
import { CTA } from '../content'
import styles from './CtaSection.module.css'

type Props = {
  onLogin: () => void
  onSignup: () => void
}

/** 마지막 화면: 로그인·회원가입으로 이끄는 버튼 */
export function CtaSection({ onLogin, onSignup }: Props) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <Reveal>
            <h2 className={styles.title}>
              <Lines text={CTA.title} />
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className={styles.body}>{CTA.body}</p>
          </Reveal>
          <Reveal delay={0.2} className={styles.buttons}>
            <Button size="lg" onClick={onLogin}>
              로그인하고 시작
            </Button>
            <Button size="lg" variant="line" onClick={onSignup}>
              처음이세요? 회원가입
            </Button>
          </Reveal>
        </div>
        <Reveal delay={0.2} y={48}>
          <img src={house} alt="" className={styles.house} />
        </Reveal>
      </div>
    </section>
  )
}
