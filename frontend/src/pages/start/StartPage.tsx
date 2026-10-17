import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRedirectAfterAuth } from '@/app/useRedirectAfterAuth'
import { AuthModal, type AuthMode } from '@/features/auth'
import {
  BrandFooter,
  BrandHeader,
  CtaSection,
  HeroSection,
  IntroSection,
  ShowcaseSection,
  StoriesSection,
  ValuesSection,
} from '@/features/brand'
import styles from './StartPage.module.css'

/* 시작 화면 = 브랜드 스토리. 섹션 순서를 바꾸거나 빼려면 여기서 줄만 옮기면 됩니다.
 * 로그인·회원가입은 AuthModal 로 띄웁니다. (/login, /signup 페이지도 같은 폼 컴포넌트를 씀) */
export function StartPage() {
  const [mode, setMode] = useState<AuthMode | null>(null)
  const navigate = useNavigate()
  const redirectTo = useRedirectAfterAuth()

  const openLogin = () => setMode('login')
  const openSignup = () => setMode('signup')

  return (
    // reducedMotion="user": 기기에서 '동작 줄이기'를 켠 사람에게는 움직임을 끔
    <MotionConfig reducedMotion="user">
      <div className={styles.page}>
        <BrandHeader onLogin={openLogin} onSignup={openSignup} />
        <main>
          <HeroSection />
          <IntroSection />
          <ValuesSection />
          <ShowcaseSection />
          <StoriesSection />
          <CtaSection onLogin={openLogin} onSignup={openSignup} />
        </main>
        <BrandFooter />
      </div>
      <AuthModal mode={mode} onModeChange={setMode} onSuccess={() => navigate(redirectTo, { replace: true })} />
    </MotionConfig>
  )
}
