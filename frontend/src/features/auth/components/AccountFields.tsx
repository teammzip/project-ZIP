import { useState, type ReactNode } from 'react'
import { getErrorMessage } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { cx } from '@/lib/cx'
import { useEmailVerification } from '../hooks/useAuthMutations'
import type { EmailPurpose } from '../types'
import styles from './Account.module.css'

/* 회원가입 · 계정 찾기 화면이 같이 쓰는 입력 부품 (라벨 왼쪽 + 밑줄 입력 형식) */

type RowProps = { id: string; label: string; hint?: string; ok?: boolean; sub?: boolean; children: ReactNode }

/** 한 줄: 왼쪽 라벨 + 오른쪽 밑줄 입력, 아래에 안내·오류 한 줄 */
export function Row({ id, label, hint, ok, sub, children }: RowProps) {
  return (
    <>
      <div className={cx(styles.row, sub && styles.rowSub)}>
        <label htmlFor={id}>{label}</label>
        <div className={styles.cell}>{children}</div>
      </div>
      {hint && (
        <p className={cx(styles.hint, ok && styles.hintOk)} role={ok ? 'status' : 'alert'}>
          {hint}
        </p>
      )}
    </>
  )
}

/** 비밀번호 보기 눈 버튼 */
export function EyeButton({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button type="button" className={cx(styles.eye, on && styles.eyeOn)} onClick={onClick} aria-label={on ? `${label} 숨기기` : `${label} 보기`} aria-pressed={on} />
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailProps = {
  id: string
  purpose: EmailPurpose
  email: string
  onEmailChange: (v: string) => void
  /** 인증을 마치면 받은 값. 비어 있으면 아직 인증 전 */
  token: string
  onToken: (token: string) => void
  /** 바깥에서 넘겨주는 오류 (예: "이메일 인증을 해 주세요.") */
  error?: string
}

/** 이메일 + 인증(필수) → 인증번호 6자리 확인. 가입 · 아이디 찾기 · 비밀번호 찾기가 같이 씀
 * (가짜 API 모드에서는 아무 6자리나 통과) */
export function EmailVerify({ id, purpose, email, onEmailChange, token, onToken, error }: EmailProps) {
  const { send, verify } = useEmailVerification(purpose)
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [localError, setLocalError] = useState('')
  const verified = !!token

  const sendCode = () => {
    const value = email.trim()
    if (!EMAIL_FORMAT.test(value) || value.length > 100) {
      setLocalError('이메일 형식을 확인해 주세요.')
      return
    }
    setLocalError('')
    send.mutate(value, { onSuccess: () => setSent(true) })
  }
  const verifyCode = () => {
    if (!/^\d{6}$/.test(code)) {
      setLocalError('인증번호 6자리를 입력해 주세요.')
      return
    }
    setLocalError('')
    verify.mutate(
      { email: email.trim(), code },
      {
        onSuccess: ({ verificationToken }) => {
          onToken(verificationToken)
          setSent(false)
          setCode('')
        },
      },
    )
  }

  const serverError = send.isError ? getErrorMessage(send.error) : verify.isError ? getErrorMessage(verify.error) : ''
  const hint = verified
    ? { ok: true, text: '이메일 인증이 완료됐어요.' }
    : localError || serverError
      ? { ok: false, text: localError || serverError }
      : sent
        ? { ok: true, text: isMockApi ? '인증번호를 보냈어요. (가짜 API 모드에서는 아무 6자리나 입력하면 돼요)' : '인증번호를 보냈어요. 메일함을 확인해 주세요.' } // 서버 모드에서는 "아무 6자리" 안내가 거짓이라 모드별로 나눔
        : { ok: false, text: error ?? '' }

  return (
    <>
      <Row id={id} label="이메일" hint={sent ? undefined : hint.text} ok={hint.ok}>
        <input
          id={id}
          type="email"
          maxLength={100}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          readOnly={verified}
          value={email}
          onChange={(e) => {
            onEmailChange(e.target.value)
            setSent(false)
          }}
        />
        <button type="button" className={cx(styles.lineBtn, verified && styles.done)} onClick={sendCode} disabled={verified || send.isPending}>
          {verified ? '인증완료' : sent ? '다시 보내기' : '인증(필수)'}
        </button>
      </Row>
      {sent && !verified && (
        <Row id={`${id}-code`} label="인증번호" sub hint={hint.text} ok={hint.ok}>
          <input id={`${id}-code`} inputMode="numeric" maxLength={6} placeholder="인증번호 6자리" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          <button type="button" className={styles.lineBtn} onClick={verifyCode} disabled={verify.isPending}>
            확인
          </button>
        </Row>
      )}
    </>
  )
}
