import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import { ConsentFields, EMPTY_CONSENT, LEGAL_VERSION, type Consent, type ConsentErrors } from '@/features/legal'
import { getErrorMessage } from '@/lib/apiClient'
import { useUpdateMe } from '../hooks/useAuthMutations'
import styles from './AuthForm.module.css'

/** 소셜 로그인으로 처음 들어온 사람: 약관 동의를 받아야 앱을 쓸 수 있음.
 * (소셜 로그인 버튼은 동의 체크 없이 바로 계정을 만들기 때문에 여기서 동의를 받음)
 * 집 주소 · 동네는 이어지는 주거 설문에서 받아요. */
export function ConsentOnboarding() {
  const updateMe = useUpdateMe()
  const [consent, setConsent] = useState<Consent>(EMPTY_CONSENT)
  const [errors, setErrors] = useState<ConsentErrors>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      terms: consent.terms ? undefined : '서비스 이용약관에 동의해 주세요.',
      privacy: consent.privacy ? undefined : '개인정보 처리방침 안내를 확인해 주세요.',
      policy: consent.policy ? undefined : '커뮤니티·AI 운영 정책에 동의해 주세요.',
      age: consent.age ? undefined : '만 14세 이상만 가입할 수 있어요.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    updateMe.mutate({ agreeTerms: true, agreePrivacy: true, agreePolicy: true, ageOver14: true, termsVersion: LEGAL_VERSION })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
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
