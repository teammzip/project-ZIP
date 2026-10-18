import { useState, type ReactNode } from 'react'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { usePhoneVerification } from '../hooks/useAuthMutations'
import type { PhonePurpose } from '../types'
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

/** 숫자만 받아 0000-0000 모양으로 */
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d
}

type PhoneProps = {
  id: string
  purpose: PhonePurpose
  /** 010- 뒤 8자리 (0000-0000) */
  phone: string
  onPhoneChange: (v: string) => void
  /** 인증을 마치면 받은 값. 비어 있으면 아직 인증 전 */
  token: string
  onToken: (token: string) => void
  /** 바깥에서 넘겨주는 오류 (예: "휴대전화 인증을 해 주세요.") */
  error?: string
}

/** 휴대전화 + 인증(필수) → 인증번호 6자리 확인. 가입 · 아이디 찾기 · 비밀번호 찾기가 같이 씀
 * (가짜 API 모드에서는 아무 6자리나 통과) */
export function PhoneVerify({ id, purpose, phone, onPhoneChange, token, onToken, error }: PhoneProps) {
  const { send, verify } = usePhoneVerification(purpose)
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [localError, setLocalError] = useState('')
  const verified = !!token

  const sendCode = () => {
    if (!/^\d{4}-\d{4}$/.test(phone)) {
      setLocalError('휴대전화 번호를 확인해 주세요. (010-0000-0000)')
      return
    }
    setLocalError('')
    send.mutate(`010-${phone}`, { onSuccess: () => setSent(true) })
  }
  const verifyCode = () => {
    if (!/^\d{6}$/.test(code)) {
      setLocalError('인증번호 6자리를 입력해 주세요.')
      return
    }
    setLocalError('')
    verify.mutate(
      { phone: `010-${phone}`, code },
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
    ? { ok: true, text: '휴대전화 인증이 완료됐어요.' }
    : localError || serverError
      ? { ok: false, text: localError || serverError }
      : sent
        ? { ok: true, text: '인증번호를 보냈어요. (가짜 API 모드에서는 아무 6자리나 입력하면 돼요)' }
        : { ok: false, text: error ?? '' }

  return (
    <>
      <Row id={id} label="휴대전화" hint={sent ? undefined : hint.text} ok={hint.ok}>
        <span className={styles.prefix}>010 -</span>
        <input
          id={id}
          inputMode="numeric"
          maxLength={9}
          placeholder="0000-0000"
          autoComplete="tel-national"
          readOnly={verified}
          value={phone}
          onChange={(e) => {
            onPhoneChange(formatPhone(e.target.value))
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
