import { useAuthStore } from '../store/authStore'
import type { User } from '../types'
import { PROVIDERS } from './providers'
import styles from './LoginMethod.module.css'

type Provider = User['provider']

/** 로그인 방식 이름 (email 은 아이디·이메일 로그인) */
const nameOf = (p: Provider) => (p === 'email' ? '아이디' : (PROVIDERS.find((x) => x.id === p)?.label ?? p))

function fmtAt(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 로그인`
}

/** 브랜드 로고 동그라미 (아이디 로그인은 집 모양) */
export function ProviderIcon({ provider }: { provider: Provider }) {
  const icon = PROVIDERS.find((x) => x.id === provider)?.icon
  return (
    <span className={`${styles.ico} ${styles[provider]}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {icon ?? <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />}
      </svg>
    </span>
  )
}

/** 프로필 아래 작은 배지: "구글 로그인" */
export function LoginBadge() {
  const provider = useAuthStore((s) => s.user?.provider) ?? 'email'
  return <span className={`${styles.badge} ${styles[provider]}`}>{nameOf(provider)} 로그인</span>
}

/** 내 정보 "계정 · 설정"의 첫 줄: 어떤 방식으로, 언제 로그인했는지 */
export function LoginMethod({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user)
  const at = useAuthStore((s) => s.loggedInAt)
  const provider = user?.provider ?? 'email'
  const social = provider !== 'email'
  const who = social ? `${nameOf(provider)} 계정과 연결됨` : (user?.username ?? user?.email ?? '')

  return (
    <div className={`${styles.row} ${className ?? ''}`}>
      <ProviderIcon provider={provider} />
      <span className={styles.text}>
        {nameOf(provider)}로 로그인했어요
        <small>
          {who}
          {at ? ` · ${fmtAt(at)}` : ''}
        </small>
      </span>
      <span className={styles.tag}>{social ? '소셜 로그인' : '일반 로그인'}</span>
    </div>
  )
}
