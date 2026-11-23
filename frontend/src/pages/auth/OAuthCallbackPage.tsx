import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import type { User } from '@/features/auth/types'
import { getErrorMessage, publicAuthClient } from '@/lib/apiClient'
import styles from './AuthPage.module.css'
import { readOAuthCallback } from '@/features/auth/oauthCallback'

/* 소셜 로그인 마무리: 백엔드가 /oauth/callback#token=... 으로 보내 주면
 * 토큰을 저장하고 내 정보(/auth/me)를 받아 로그인 상태로 만든 뒤 홈으로 이동. */
export function OAuthCallbackPage() {
  const location = useLocation()
  const [callback] = useState(() => readOAuthCallback(location.search, location.hash))
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { token, hasQueryToken } = callback
  const [requestError, setRequestError] = useState<string | null>(null)
  // 백엔드가 실패 이유를 ?error= 로 보내 주면 그대로 보여줌
  const error = token ? requestError : (callback.error ?? '로그인 정보가 없어요. 다시 시도해 주세요.')
  const started = useRef(false) // StrictMode 에서 두 번 실행되는 것 방지

  useEffect(() => {
    if (started.current || (!token && !hasQueryToken)) return
    started.current = true

    // 로그인에 사용하지 않는 쿼리 토큰도 주소에서 제거한다.
    window.history.replaceState(window.history.state, '', window.location.pathname)
    if (!token) return

    // 이전 회원 상태와 새 토큰이 섞이지 않도록 비운다.
    useAuthStore.getState().clearAuth()

    publicAuthClient.get<User>('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data: user }) => {
        if (useAuthStore.getState().sessionKey) return
        setAuth(user, token, true)
        navigate('/', { replace: true })
      })
      .catch((e) => {
        if (useAuthStore.getState().sessionKey) return
        setRequestError(getErrorMessage(e))
      })
  }, [token, hasQueryToken, navigate, setAuth])

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
