import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { fmt, monthDay } from '@/lib/date'
import { VERIFY_DAYS, useRegionVerify } from '../derive'
import { locateRegion, sameRegion } from '../locateRegion'
import { useLifeStore } from '../store'
import styles from './verify.module.css'

type Step = { kind: 'idle' } | { kind: 'locating' } | { kind: 'done'; region: string } | { kind: 'other'; found: string } | { kind: 'error'; message: string }

type Props = {
  open: boolean
  onClose: () => void
  /** 인증을 마쳤을 때 (예: 커뮤니티에서 바로 글쓰기 열기) */
  onVerified?: () => void
}

/** 동네 인증 창: 지금 위치를 확인해 우리 동네와 같으면 인증 완료.
 * 다른 동네에 있으면 "그 동네로 바꾸고 인증"을 고를 수 있음 (당근 동네 인증처럼) */
export function RegionVerifyDialog({ open, onClose, onVerified }: Props) {
  const { region, verified, at, left } = useRegionVerify()
  const verifyRegion = useLifeStore((s) => s.verifyRegion)
  const [step, setStep] = useState<Step>({ kind: 'idle' })

  const close = () => {
    setStep({ kind: 'idle' })
    onClose()
  }
  const finish = (r: string) => {
    verifyRegion(r)
    setStep({ kind: 'done', region: r })
  }
  const start = async () => {
    setStep({ kind: 'locating' })
    try {
      const found = await locateRegion()
      if (region && sameRegion(region, found)) finish(region)
      else setStep({ kind: 'other', found })
    } catch (err) {
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
              이제 동네생활에 글 · 댓글 · 공감을 남길 수 있어요.
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
        ) : step.kind === 'other' ? (
          <>
            <h3>지금 위치는 {step.found}예요</h3>
            <p>
              {region ? (
                <>
                  우리 동네({region})와 달라요.
                  <br />
                </>
              ) : null}
              이 동네를 우리 동네로 바꾸고 인증할까요?
            </p>
            <div className={styles.actions}>
              <Button variant="line" onClick={close}>
                취소
              </Button>
              <Button onClick={() => finish(step.found)}>이 동네로 인증</Button>
            </div>
          </>
        ) : (
          <>
            <h3>동네 인증</h3>
            <p>
              지금 있는 위치로 우리 동네가 맞는지 확인해요.
              <br />
              인증하면 동네생활에 글 · 댓글 · 공감을 남길 수 있어요.
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
