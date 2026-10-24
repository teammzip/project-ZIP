import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { useSocialLogin } from '../hooks/useAuthMutations'
import { PROVIDERS } from './providers'
import styles from './AuthForm.module.css'


type Props = { onSuccess?: () => void }

/** 카카오 · 구글 · 네이버 동그란 버튼 */
export function SocialLoginButtons({ onSuccess }: Props) {
  const social = useSocialLogin()

  return (
    <div>
      <div className={styles.divider}>또는</div>
      <div className={styles.social}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={cx(styles.socialButton, styles[p.id])}
            onClick={() => social.mutate(p.id, { onSuccess })}
            disabled={social.isPending}
            aria-label={`${p.label}로 로그인`}
            title={p.label}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {p.icon}
            </svg>
          </button>
        ))}
      </div>
      {social.isError && (
        <p className={styles.serverError} role="alert">
          {getErrorMessage(social.error)}
        </p>
      )}
    </div>
  )
}
