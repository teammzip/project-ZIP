import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRedirectAfterAuth } from '@/app/useRedirectAfterAuth'
import { AuthModal } from '@/features/auth'
import {
  BrandFooter,
  BrandHeader,
  CinemaSection,
  CloudSection,
  CtaSection,
  FocusSection,
  HeroSection,
  MobileIntro,
  ShowcaseSection,
  StoriesSection,
} from '@/features/brand'
import { useMediaQuery } from '@/lib/useMediaQuery'
import styles from './StartPage.module.css'

/* 시작 화면
 * - PC: 브랜드 스토리 (섹션 순서를 바꾸거나 빼려면 여기서 줄만 옮기면 됩니다)
 * - 모바일(900px 이하): 앱 시작 → 로봇 → 문 → 로그인 인트로 (팀 시안 variants/start-mobile)
 * 로그인은 AuthModal, 회원가입·아이디/비밀번호 찾기는 별도 페이지(/signup, /find).
 * /start#login 으로 오면(가입·찾기 페이지의 "로그인") PC 는 로그인 창을 바로 열고, 모바일은 문이 저절로 열린 뒤 로그인 창이 뜸 */
export function StartPage() {
  const navigate = useNavigate()
  const { hash, pathname, search, state } = useLocation()
  const redirectTo = useRedirectAfterAuth()
  const isMobile = useMediaQuery('(max-width: 900px)')
  const fromLogin = hash === '#login'
  const [loginOpen, setLoginOpen] = useState(fromLogin && !isMobile)
  // #login 은 한 번만 쓰고 지움 (새로고침해도 또 자동으로 열리지 않게)
  const [autoDoor] = useState(fromLogin && isMobile)
  useEffect(() => {
    if (fromLogin) navigate({ pathname, search }, { replace: true, state })
  }, [fromLogin, navigate, pathname, search, state])

  const openLogin = () => setLoginOpen(true)
  const goSignup = () => navigate('/signup', { state })
  const modal = <AuthModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => navigate(redirectTo, { replace: true })} />

  if (isMobile) {
    return (
      <MotionConfig reducedMotion="user">
        <MobileIntro onEnter={openLogin} onSignup={goSignup} paused={loginOpen} autoDoor={autoDoor} />
        {modal}
      </MotionConfig>
    )
  }

  return (
    // reducedMotion="user": 기기에서 '동작 줄이기'를 켠 사람에게는 움직임을 끔
    <MotionConfig reducedMotion="user">
      <div className={styles.page}>
        <BrandHeader onLogin={openLogin} onSignup={goSignup} />
        <main>
          {/* 오늘의집 브랜드 페이지 흐름: 첫 화면 → 카드 구름이 로고로 → 어두운 장면 → 한 줄씩 강조 → 앱 화면 → 이야기 */}
          <HeroSection />
          <CloudSection />
          <CinemaSection />
          <FocusSection />
          <ShowcaseSection />
          <StoriesSection />
          <CtaSection onLogin={openLogin} onSignup={goSignup} />
        </main>
        <BrandFooter />
      </div>
      {modal}
    </MotionConfig>
  )
}
