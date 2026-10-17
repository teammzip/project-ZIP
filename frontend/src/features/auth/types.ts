/* 인증 관련 타입. 백엔드와 요청/응답 모양을 맞출 때 이 파일을 기준으로 이야기하면 됩니다. */

export type SocialProvider = 'kakao' | 'google' | 'naver'

export type User = {
  id: string
  email: string
  nickname: string
  address: string
  provider: 'email' | SocialProvider
}

/** POST /auth/login */
export type LoginRequest = {
  email: string
  password: string
}

/** POST /auth/signup */
export type SignupRequest = {
  email: string
  password: string
  nickname: string
  address: string
  agreeTerms: boolean
}

/** 로그인·회원가입 성공 응답 */
export type AuthResponse = {
  accessToken: string
  user: User
}

/** 실제 API 와 가짜(mock) API 가 똑같이 지켜야 하는 약속 */
export interface AuthApi {
  login(req: LoginRequest): Promise<AuthResponse>
  signup(req: SignupRequest): Promise<AuthResponse>
  /** GET /auth/me — 토큰으로 내 정보 조회 (소셜 로그인 콜백에서 사용) */
  me(): Promise<User>
  logout(): Promise<void>
  /** 소셜 로그인 시작. 실제 API 는 소셜 로그인 페이지로 이동하므로 값을 돌려주지 않음 */
  startSocialLogin(provider: SocialProvider): Promise<AuthResponse | void>
}
