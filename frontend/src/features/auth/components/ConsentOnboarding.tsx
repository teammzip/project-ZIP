import { useState, type FormEvent } from 'react'
import { Button, TextField } from '@/components/ui'
import { ConsentFields, EMPTY_CONSENT, LEGAL_VERSION, type Consent, type ConsentErrors } from '@/features/legal'
import { getErrorMessage } from '@/lib/apiClient'
import { useLogout, useUpdateMe } from '../hooks/useAuthMutations'
import { useAuthStore } from '../store/authStore'
import styles from './AuthForm.module.css'

/** 소셜 로그인으로 처음 들어온 사람: 약관 동의 + 주소를 받아야 앱을 쓸 수 있음.
 * (소셜 로그인 버튼은 동의 체크 없이 바로 계정을 만들기 때문에 여기서 동의를 받음) */
export function ConsentOnboarding() {
  const user = useAuthStore((s) => s.user)
  const updateMe = useUpdateMe()
  const logout = useLogout()
  const [consent, setConsent] = useState<Consent>(EMPTY_CONSENT)
  const [address, setAddress] = useState(user?.address ?? '')
  const [errors, setErrors] = useState<ConsentErrors & { address?: string }>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      terms: consent.terms ? undefined : '서비스 이용약관에 동의해 주세요.',
      privacy: consent.privacy ? undefined : '개인정보 처리방침 안내를 확인해 주세요.',
      policy: consent.policy ? undefined : '커뮤니티·AI 운영 정책에 동의해 주세요.',
      age: consent.age ? undefined : '만 14세 이상만 가입할 수 있어요.',
      address: address.trim() ? undefined : '주소를 입력해 주세요.',
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    updateMe.mutate({ address: address.trim(), agreeTerms: true, agreePrivacy: true, agreePolicy: true, ageOver14: true, termsVersion: LEGAL_VERSION })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <TextField
        label="주소"
        placeholder="예: 서울시 마포구 합정동 123-4"
        autoComplete="street-address"
        hint="우리 동네 커뮤니티·지도·쓰레기 배출 정보에 써요."
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        error={errors.address}
      />
      <ConsentFields value={consent} onChange={setConsent} errors={errors} />
      {updateMe.isError && (
        <p className={styles.serverError} role="alert">
          {getErrorMessage(updateMe.error)}
        </p>
      )}
      <Button type="submit" size="lg" block loading={updateMe.isPending}>
        동의하고 시작하기
      </Button>
      <Button variant="ghost" block onClick={() => logout.mutate()}>
        동의하지 않고 나가기
      </Button>
    </form>
  )
}
