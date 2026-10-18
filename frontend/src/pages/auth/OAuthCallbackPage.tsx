import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, useAuthStore } from '@/features/auth'
import { getErrorMessage } from '@/lib/apiClient'
import styles from './AuthPage.module.css'

/* 소셜 로그인 마무리: 백엔드가 /oauth/callback?token=... 으로 보내 주면
 * 토큰을 저장하고 내 정보(/auth/me)를 받아 로그인 상태로 만든 뒤 홈으로 이동. */
export function OAuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const token = params.get('token')
  const [requestError, setRequestError] = useState<string | null>(null)
  const error = token ? requestError : '로그인 정보가 없어요. 다시 시도해 주세요.'
  const started = useRef(false) // StrictMode 에서 두 번 실행되는 것 방지

  useEffect(() => {
    if (!token || started.current) return
    started.current = true

    // me() 요청에 토큰이 실리도록 먼저 임시로 저장
    useAuthStore.setState({ token })
    authApi
      .me()
      .then((user) => {
        setAuth(user, token, true)
        navigate('/', { replace: true })
      })
      .catch((e) => {
        useAuthStore.getState().clearAuth()
        setRequestError(getErrorMessage(e))
      })
  }, [token, navigate, setAuth])

  return (
    <div className={styles.callback}>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <Link to="/login">로그인 화면으로</Link>
        </>
      ) : (
        <p>로그인하는 중…</p>
      )}
    </div>
  )
}
