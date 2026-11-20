import { Link } from 'react-router-dom'
import robot from '@/assets/images/robot-cut.png'
import { Modal } from '@/components/ui'
import { demoAccount, demoAdmin } from '../api'
import { LoginForm } from './LoginForm'
import { SocialLoginButtons } from './SocialLoginButtons'
import styles from './AuthModal.module.css'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

/** 시작 화면의 로그인 모달. 회원가입·아이디/비밀번호 찾기는 별도 페이지(/signup, /find)로 이동 (팀 시안과 같음)
 * 디자인은 시작 화면과 같은 톤: 둥근 흰 창 · 로봇 · 남색 굵은 제목 · 둥근 입력칸 · 파란 둥근 버튼 */
export function AuthModal({ open, onClose, onSuccess }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="로그인" className={styles.dialog}>
      <div className={styles.head}>
        <img src={robot} alt="" className={styles.robot} />
        <div>
          <p className={styles.kicker}>자취생 생활 도우미 ZIP</p>
          <p className={styles.title} aria-hidden="true">
            다시 만나서 <span>반가워요</span>
          </p>
        </div>
      </div>
      <LoginForm onSuccess={onSuccess} />
      <SocialLoginButtons onSuccess={onSuccess} />
      <p className={styles.switch}>
        아직 계정이 없나요? <Link to="/signup">회원가입</Link>
      </p>
      {demoAccount && (
        <p className={styles.demoNote}>
          데모 계정 {demoAccount.username} (또는 {demoAccount.email}) / {demoAccount.password}
          {demoAdmin && (
            <>
              <br />
              관리자 {demoAdmin.username} / {demoAdmin.password}
            </>
          )}
        </p>
      )}
    </Modal>
  )
}
