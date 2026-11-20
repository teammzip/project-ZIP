import { Link, Outlet, useLocation } from 'react-router-dom'
import house from '@/assets/images/house-mobile.png'
import logo from '@/assets/images/logo-zip.png'
import robot from '@/assets/images/robot-cut.png'
import { LegalLinks } from '@/features/legal'
import styles from './AccountLayout.module.css'

const POINTS = ['월세 · 공과금 납부일을 홈에서 D-day로', '할 일 · 쓰레기 배출 요일을 달력 한 곳에', '사진 한 장으로 물어보는 AI 자취 도우미']

/** 로그인 · 회원가입 · 아이디/비밀번호 찾기 페이지의 틀 (시작 화면과 같은 하늘색 · 남색 톤)
 * PC(1100px 이상): 왼쪽 ZIP 소개(제목 · 3D 로봇과 집 · 장점 3줄) + 오른쪽 둥근 흰 카드
 * 태블릿(900~1100px): 가운데 카드만 / 모바일(900px 이하): 흰 카드만 화면 가득 */
export function AccountLayout() {
  const { pathname, state } = useLocation()
  const onLogin = pathname === '/login'
  // 로그인 페이지에선 "회원가입"으로, 가입 · 찾기 페이지에선 "로그인"(시작 화면의 로그인 창)으로 (원래 가려던 곳 state 는 그대로 넘김)
  const other = onLogin ? { ask: '아직 계정이 없나요?', to: '/signup', label: '회원가입' } : { ask: '이미 계정이 있나요?', to: '/start#login', label: '로그인' }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link to="/start" aria-label="ZIP 시작 화면으로">
          <img src={logo} alt="ZIP" />
        </Link>
        <p className={styles.toLogin}>
          {other.ask}
          <Link to={other.to} state={state} className={styles.loginPill}>
            {other.label}
          </Link>
        </p>
      </header>

      <div className={styles.body}>
        <aside className={styles.intro} aria-hidden="true">
          <p className={styles.kicker}>자취생 생활 도우미 ZIP</p>
          <p className={styles.headline}>
            혼자 사는 하루,
            <br />
            <span>ZIP이 함께 챙겨요.</span>
          </p>
          <ul className={styles.points}>
            {POINTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className={styles.visual}>
            <img src={house} alt="" className={styles.house} />
            <img src={robot} alt="" className={styles.robot} />
            <span className={styles.bubble}>
              <i>✓</i>
              {onLogin ? '다시 만나서 반가워요!' : '가입은 1분이면 끝나요!'}
            </span>
          </div>
        </aside>

        <main className={styles.card}>
          <Outlet />
          {/* 로그인 페이지는 본문 아래에 이미 "회원가입" 안내가 있어서 가입 · 찾기 페이지에서만 */}
          {!onLogin && (
            <p className={styles.mOnly}>
              이미 계정이 있나요?{' '}
              <Link to="/start#login" state={state}>
                로그인
              </Link>
            </p>
          )}
          <LegalLinks className={styles.legal} />
        </main>
      </div>
    </div>
  )
}
