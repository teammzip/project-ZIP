import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { ConsentFields, EMPTY_CONSENT, LEGAL_VERSION, type Consent, type ConsentErrors } from '@/features/legal'
import { getErrorMessage } from '@/lib/apiClient'
import { useUpdateMe } from '../hooks/useAuthMutations'
import { useAuthStore } from '../store/authStore'
import { REGIONS, SIDO_LIST, parseRegion } from '../data/regions'
import styles from './AuthForm.module.css'
import radio from './ConsentOnboarding.module.css'


/** 소셜 로그인으로 처음 들어온 사람: 약관 동의 + 주소를 받아야 앱을 쓸 수 있음.
 * (소셜 로그인 버튼은 동의 체크 없이 바로 계정을 만들기 때문에 여기서 동의를 받음) */
export function ConsentOnboarding() {
  const user = useAuthStore((s) => s.user)
  const updateMe = useUpdateMe()
  const [consent, setConsent] = useState<Consent>(EMPTY_CONSENT)
  const initial = parseRegion(user?.address ?? '')
  const [sido, setSido] = useState(initial.sido)
  const [address, setAddress] = useState(initial.sigungu)
  // 어느 목록이 펼쳐져 있는지 (한 번에 하나)
  const [open, setOpen] = useState<'sido' | 'gu' | null>(null)
  const cols = useRef<HTMLDivElement>(null)
  // 바깥을 누르거나 Esc 를 누르면 닫힘
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!cols.current?.contains(e.target as Node)) setOpen(null) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const [errors, setErrors] = useState<ConsentErrors & { address?: string }>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      terms: consent.terms ? undefined : '서비스 이용약관에 동의해 주세요.',
      privacy: consent.privacy ? undefined : '개인정보 처리방침 안내를 확인해 주세요.',
      policy: consent.policy ? undefined : '커뮤니티·AI 운영 정책에 동의해 주세요.',
      age: consent.age ? undefined : '만 14세 이상만 가입할 수 있어요.',
      address: !sido ? '시·도를 선택해 주세요.' : address ? undefined : '시·군·구를 선택해 주세요.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    updateMe.mutate({ address: `${sido} ${address}`, agreeTerms: true, agreePrivacy: true, agreePolicy: true, ageOver14: true, termsVersion: LEGAL_VERSION })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={radio.cols} ref={cols}>
        <fieldset className={radio.col}>
          <legend className={radio.legend}>시·도</legend>
          <button type="button" className={radio.trigger} aria-expanded={open === 'sido'} onClick={() => setOpen(open === 'sido' ? null : 'sido')}>
            <span className={sido ? undefined : radio.placeholder}>{sido || '시·도 선택'}</span>
            <span aria-hidden>{open === 'sido' ? '▲' : '▼'}</span>
          </button>
          {open === 'sido' && (
            <div className={radio.list} role="radiogroup" aria-label="시·도">
              {SIDO_LIST.map((name) => (
                <label key={name} className={radio.opt}>
                  <input type="radio" name="sido" value={name} checked={sido === name} onChange={() => { setSido(name); setAddress(''); setOpen('gu') }} onClick={() => { if (sido === name) { setSido(''); setAddress(''); setOpen(null) } }} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <fieldset className={radio.col} disabled={!sido}>
          <legend className={radio.legend}>시·군·구</legend>
          <button type="button" className={radio.trigger} aria-expanded={open === 'gu'} disabled={!sido} onClick={() => setOpen(open === 'gu' ? null : 'gu')}>
            <span className={address ? undefined : radio.placeholder}>{address || (sido ? '시·군·구 선택' : '시·도 먼저')}</span>
            <span aria-hidden>{open === 'gu' ? '▲' : '▼'}</span>
          </button>
          {sido && open === 'gu' && (
            <div className={radio.list} role="radiogroup" aria-label="시·군·구">
              {REGIONS[sido].map((gu) => (
                <label key={gu} className={radio.opt}>
                  <input type="radio" name="sigungu" value={gu} checked={address === gu} onChange={() => { setAddress(gu); setOpen(null) }} onClick={() => { if (address === gu) { setAddress(''); setOpen(null) } }} />
                  <span>{gu}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </div>
      {errors.address ? <p className={radio.error} role="alert">{errors.address}</p> : <p className={radio.hint}>우리 동네 커뮤니티·지도·쓰레기 배출 정보에 써요.</p>}
      <ConsentFields value={consent} onChange={setConsent} errors={errors} />
      {updateMe.isError && (
        <p className={styles.serverError} role="alert">
          {getErrorMessage(updateMe.error)}
        </p>
      )}
      <Button type="submit" size="lg" block loading={updateMe.isPending}>
        시작하기
      </Button>
    </form>
  )
}
