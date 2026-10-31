import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { authApi } from '@/features/auth/api'
import { Button, Modal } from '@/components/ui'
import { fmt, monthDay } from '@/lib/date'
import { VERIFY_DAYS, useRegionVerify } from '../derive'
import { locateRegion } from '../locateRegion'
import { useLifeStore } from '../store'
import styles from './verify.module.css'

type Step = { kind: 'idle' } | { kind: 'locating' } | { kind: 'done'; region: string } | { kind: 'error'; message: string }

type Props = {
  open: boolean
  onClose: () => void
  /** 인증을 마쳤을 때 (예: 커뮤니티에서 바로 글쓰기 열기) */
  onVerified?: () => void
}

/** GPS로 확인한 동네를 회원 주소·생활 설정에 적용하고 인증한다. */
export function RegionVerifyDialog({ open, onClose, onVerified }: Props) {
  const { region, verified, at, left } = useRegionVerify()
  const verifyRegion = useLifeStore((s) => s.verifyRegion)
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const request = useRef({ id: 0 })
  useEffect(() => {
    const pending = request.current
    return () => { pending.id++ }
  }, [open, region])

  const close = () => {
    request.current.id++
    setStep({ kind: 'idle' })
    onClose()
  }
  const start = async () => {
    const attempt = ++request.current.id
    const userId = useAuthStore.getState().user?.id
    setStep({ kind: 'locating' })
    try {
      const found = await locateRegion()
      if (attempt !== request.current.id || userId !== useAuthStore.getState().user?.id || region !== useLifeStore.getState().settings.region) return
      const user = await authApi.updateMe({ address: found })
      if (attempt !== request.current.id || userId !== useAuthStore.getState().user?.id || region !== useLifeStore.getState().settings.region) return
      const firstLogin = useAuthStore.getState().user?.firstLogin
      useAuthStore.getState().updateUser({ ...user, firstLogin })
      verifyRegion(found)
      setStep({ kind: 'done', region: found })
    } catch (err) {
      if (attempt !== request.current.id) return
      setStep({ kind: 'error', message: err instanceof Error ? err.message : '위치를 확인하지 못했어요.' })
    }
  }

  return (
    <Modal open={open} onClose={close} title="동네 인증">
      <div className={styles.box}>
        <span className={styles.pin} aria-hidden="true">
          {step.kind === 'done' ? '✅' : '📍'}
        </span>

        {step.kind === 'done' ? (
          <>
            <h3>{step.region} 인증 완료!</h3>
            <p>
              날씨와 지도가 인증한 동네로 변경됐어요. 이제 커뮤니티도 이용할 수 있어요.
              <br />
              인증은 {VERIFY_DAYS}일 동안 유지돼요.
            </p>
            <Button
              block
              onClick={() => {
                close()
                onVerified?.()
              }}
            >
              확인
            </Button>
          </>
        ) : (
          <>
            <h3>동네 인증</h3>
            <p>
              현재 위치를 확인해 우리 동네로 적용해요.
              <br />
              인증하면 날씨와 지도가 현재 동네로 변경되고 커뮤니티를 이용할 수 있어요.
            </p>
            <div className={styles.current}>
              <span>우리 동네</span>
              <b>{region || '아직 정하지 않았어요'}</b>
              {verified && at && (
                <small>
                  {monthDay(fmt(new Date(at)))} 인증 · {left}일 남음
                </small>
              )}
            </div>
            {step.kind === 'error' && (
              <p className={styles.error} role="alert">
                {step.message}
              </p>
            )}
            <Button block size="lg" onClick={start} disabled={step.kind === 'locating'}>
              {step.kind === 'locating' ? '위치 확인 중…' : verified ? '다시 인증하기' : '현재 위치로 인증하기'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
