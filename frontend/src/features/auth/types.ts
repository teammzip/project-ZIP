/* 인증 관련 타입. 백엔드와 요청/응답 모양을 맞출 때 이 파일을 기준으로 이야기하면 됩니다. */

export type SocialProvider = 'kakao' | 'google' | 'naver'

export type User = {
  id: string
  /** 로그인 아이디 (6~16자 영문 소문자·숫자). 소셜 가입자는 없을 수 있음 */
  username?: string
  email: string
  nickname: string
  address: string
  provider: 'email' | SocialProvider
  /** 약관·개인정보 수집에 동의한 시각 (ISO). 소셜 로그인으로 처음 들어온 사람은 null → 동의 화면(/welcome)으로 보냄 */
  agreedAt?: string | null
}

/** POST /auth/login — loginId 는 아이디 또는 이메일 */
export type LoginRequest = {
  loginId: string
  password: string
}

/** 가입 약관 동의 (모두 필수) */
export type ConsentRequest = {
  agreeTerms: boolean
  agreePrivacy: boolean
  agreePolicy: boolean
  ageOver14: boolean
  /** 동의한 약관 버전 (features/legal 의 LEGAL_VERSION) */
  termsVersion: string
}

/** POST /auth/signup */
export type SignupRequest = ConsentRequest & {
  username: string
  password: string
  nickname: string
  /** 010-0000-0000 */
  phone: string
  /** 휴대전화 인증을 마치고 받은 값 (POST /auth/phone/verify 응답) */
  phoneVerificationToken: string
  email: string
  address: string
}

/** PATCH /auth/me — 닉네임 수정, 또는 소셜 첫 가입 때 주소·동의 받기 */
export type UpdateMeRequest = Partial<ConsentRequest> & {
  nickname?: string
  address?: string
}

/** POST /auth/find-id — 가입할 때 쓴 닉네임 + 주소 */
export type FindIdRequest = { nickname: string; address: string }
/** 일부를 가린 아이디 (예: zi****12) */
export type FindIdResponse = { maskedUsername: string }

/** POST /auth/password-reset — 아이디 + 가입한 이메일로 재설정 안내 메일 */
export type PasswordResetRequest = { username: string; email: string }

/** 로그인·회원가입 성공 응답 */
export type AuthResponse = {
  accessToken: string
  user: User
}

/** 실제 API 와 가짜(mock) API 가 똑같이 지켜야 하는 약속 */
export interface AuthApi {
  login(req: LoginRequest): Promise<AuthResponse>
  signup(req: SignupRequest): Promise<AuthResponse>
  /** POST /auth/phone/send — 휴대전화로 인증번호 보내기 */
  sendPhoneCode(phone: string): Promise<void>
  /** POST /auth/phone/verify — 인증번호 확인. 맞으면 가입할 때 함께 보낼 값을 줌 */
  verifyPhoneCode(phone: string, code: string): Promise<{ verificationToken: string }>
  findId(req: FindIdRequest): Promise<FindIdResponse>
  /** 계정이 있든 없든 같은 응답 (가입 여부를 남이 알아내지 못하게) */
  requestPasswordReset(req: PasswordResetRequest): Promise<void>
  /** GET /auth/me — 토큰으로 내 정보 조회 (소셜 로그인 콜백에서 사용) */
  me(): Promise<User>
  logout(): Promise<void>
  /** 소셜 로그인 시작. 실제 API 는 소셜 로그인 페이지로 이동하므로 값을 돌려주지 않음 */
  startSocialLogin(provider: SocialProvider): Promise<AuthResponse | void>
  /** PATCH /auth/me — 내 정보 수정 */
  updateMe(req: UpdateMeRequest): Promise<User>
  /** DELETE /auth/me — 회원 탈퇴 (서버에 저장된 내 정보 삭제) */
  withdraw(): Promise<void>
}
