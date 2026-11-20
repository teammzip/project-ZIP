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
  FeatureListSection,
  FocusSection,
  HeroSection,
  MobileIntro,
  QuestionSection,
  ShowcaseSection,
  StepsSection,
  StoriesSection,
} from '@/features/brand'
import { useMediaQuery } from '@/lib/useMediaQuery'
import styles from './StartPage.module.css'

/* 시작 화면 (섹션 순서를 바꾸거나 빼려면 여기서 줄만 옮기면 됩니다)
 * - PC: 브랜드 스토리 (화면에 고정되는 스크롤 연출 포함)
 * - 모바일(900px 이하): 로봇 인트로 한 화면 → 아래로 질문 · 기능 · 이야기 · 시작 3단계 · 마지막 버튼 (무거운 고정 연출은 빼고)
 * 로그인은 AuthModal(시작 화면 위에 뜨는 창), 회원가입·아이디/비밀번호 찾기는 별도 페이지(/signup, /find).
 * /start#login 으로 오면(가입·찾기 페이지의 "로그인") PC 는 로그인 창을 바로 열고, 모바일도 로그인 창을 바로 열음 */
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

  return (
    // reducedMotion="user": 기기에서 '동작 줄이기'를 켠 사람에게는 움직임을 끔
    <MotionConfig reducedMotion="user">
      <div className={styles.page}>
        <BrandHeader onLogin={openLogin} onSignup={goSignup} actionsOnScroll={isMobile} />
        {isMobile ? (
          <main>
            <MobileIntro onEnter={openLogin} onSignup={goSignup} paused={loginOpen} autoDoor={autoDoor} />
            <QuestionSection />
            <FeatureListSection />
            <StoriesSection />
            <StepsSection />
            <CtaSection onLogin={openLogin} onSignup={goSignup} />
          </main>
        ) : (
          <main>
            {/* 첫 화면 → 카드 구름이 돌며 로고로 → 작은 불편(로봇 · 말풍선) → 어두운 장면 → 한 줄씩 강조 → 앱 화면 → 기능 목록 → 이야기 → 시작 3단계 → 마지막 */}
            <HeroSection />
            <CloudSection />
            <QuestionSection />
            <CinemaSection />
            <FocusSection />
            <ShowcaseSection />
            <FeatureListSection />
            <StoriesSection />
            <StepsSection />
            <CtaSection onLogin={openLogin} onSignup={goSignup} />
          </main>
        )}
        <BrandFooter />
      </div>
      {modal}
    </MotionConfig>
  )
}
