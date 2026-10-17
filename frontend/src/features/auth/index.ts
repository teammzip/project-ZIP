/* auth 기능의 바깥 창구. 다른 폴더에서는 '@/features/auth' 에서만 가져다 쓰세요. (안쪽 파일 구조는 바뀔 수 있음) */
export { AuthModal, type AuthMode } from './components/AuthModal'
export { LoginForm } from './components/LoginForm'
export { SignupForm } from './components/SignupForm'
export { SocialLoginButtons } from './components/SocialLoginButtons'
export { useLogin, useLogout, useSignup, useSocialLogin } from './hooks/useAuthMutations'
export { selectIsLoggedIn, useAuthStore } from './store/authStore'
export { authApi, demoAccount, isMockApi } from './api'
export type { SocialProvider, User } from './types'
